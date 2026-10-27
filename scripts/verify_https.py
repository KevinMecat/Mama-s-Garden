"""Check real HTTP/TLS responses without logging headers, bodies or credentials."""

import argparse
import base64
import hashlib
import re
import subprocess
import tempfile
from pathlib import Path


def main():
    if not __debug__:
        raise SystemExit("No ejecutar el verificador con optimización de Python.")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("domain")
    parser.add_argument("--resolve", help="Test-only address; default uses public DNS")
    parser.add_argument(
        "--ca", type=Path, help="CI test certificate; omit for public CA trust"
    )
    args = parser.parse_args()
    if not re.fullmatch(r"[a-z0-9.-]+", args.domain):
        raise SystemExit("Dominio inválido.")
    options = ["curl", "--silent", "--show-error", "--max-time", "20", "--noproxy", "*"]
    if args.ca:
        options += ["--cacert", str(args.ca)]

    def fetch(scheme, route, extras=()):
        command = options.copy()
        if args.resolve:
            port = 443 if scheme == "https" else 80
            command += ["--resolve", f"{args.domain}:{port}:{args.resolve}"]
        with tempfile.TemporaryDirectory() as directory:
            body = Path(directory) / "body"
            result = subprocess.run(
                [
                    *command,
                    *extras,
                    "-D",
                    "-",
                    "-o",
                    str(body),
                    f"{scheme}://{args.domain}{route}",
                ],
                capture_output=True,
                check=False,
            )
            if result.returncode:
                raise SystemExit("Fallo de conexión o validación TLS; valores ocultos.")
            headers = result.stdout.decode("iso-8859-1")
            return headers, body.read_text(encoding="utf-8", errors="replace")

    headers, _ = fetch("http", "/login")
    assert re.search(r"HTTP/\S+ 301\b", headers), "HTTP debe devolver 301"
    assert f"location: https://{args.domain}/login" in headers.lower(), (
        "Destino no canónico"
    )
    required = {
        "strict-transport-security": "max-age=31536000; includesubdomains; preload",
        "x-frame-options": "deny",
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
    }
    for route, expected in (
        ("/login", 200),
        ("/api/v1/health/", 200),
        ("/static/admin/css/base.css", 200),
        ("/media/private", 404),
        ("/this-route-does-not-exist", 404),
    ):
        headers, body = fetch("https", route, ["-H", "X-Forwarded-Proto: http"])
        assert re.search(rf"HTTP/\S+ {expected}\b", headers), "Estado inesperado"
        pairs = {}
        for line in headers.splitlines():
            name, separator, value = line.partition(":")
            if separator:
                pairs.setdefault(name.lower(), []).append(value.strip().lower())
        for key, value in required.items():
            assert pairs.get(key) == [value], f"Cabecera inválida o duplicada: {key}"
        assert len(pairs.get("content-security-policy", [])) == 1, (
            "CSP ausente/duplicada"
        )
        if route == "/login":
            policy = pairs["content-security-policy"][0]
            assert "'sha256-" in policy and "'unsafe-eval'" not in policy
            actual_policy = re.search(r"(?im)^content-security-policy: (.+)$", headers)[
                1
            ]
            for attrs, source in re.findall(
                r"<script\b([^>]*)>([\s\S]*?)</script>", body
            ):
                if source and not re.search(r"\bsrc\s*=", attrs):
                    digest = base64.b64encode(
                        hashlib.sha256(source.encode()).digest()
                    ).decode()
                    assert f"'sha256-{digest}'" in actual_policy, "Script fuera de CSP"
    headers, _ = fetch("https", "/api/v1/auth/csrf/")
    assert re.search(r"set-cookie:.*; Secure", headers, re.IGNORECASE), (
        "Cookie CSRF no segura"
    )
    print(
        "TLS, 301, cabeceras en 2xx/4xx, CSP hashes, cookies y forwarding: correctos."
    )


if __name__ == "__main__":
    main()
