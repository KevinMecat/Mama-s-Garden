"""Fail closed on invalid production configuration. Never report values."""

import argparse
import os
import re
import sys
from pathlib import Path
from urllib.parse import unquote, urlsplit

TEMPLATE = Path(__file__).resolve().parents[1] / "config/environment.example"
DOMAIN_PATTERN = re.compile(
    r"(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}"
)


def read_env(path):
    result = {}
    for line in Path(path).read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        name, separator, value = line.partition("=")
        if (
            not separator
            or not re.fullmatch(r"[A-Z][A-Z0-9_]*", name)
            or name in result
        ):
            raise ValueError("Invalid environment format")
        value = value.strip()
        if value.startswith(("'", '"')):
            if len(value) < 2 or value[-1] != value[0]:
                raise ValueError("Invalid environment format")
            value = value[1:-1]
        if any(token in value for token in ("$", "`", "\n", "\r", "\x00")):
            raise ValueError("Unsafe interpolation")
        result[name] = value
    return result


def strong_secret(value, minimum):
    lowered = value.lower()
    return (
        len(value) >= minimum
        and len(set(value)) >= min(20, minimum // 2)
        and re.fullmatch(r"[A-Za-z0-9_-]+", value) is not None
        and not any(
            word in lowered
            for word in (
                "password",
                "changeme",
                "change-this",
                "placeholder",
                "example",
                "dev-only",
                "django-insecure",
                "finca_dev",
                "secret",
                "default",
            )
        )
    )


def validate_env(values, template=TEMPLATE):
    required = read_env(template)
    errors = {key for key in required if not values.get(key, "").strip()}
    domain = values.get("DOMAIN", "")
    if (
        not DOMAIN_PATTERN.fullmatch(domain)
        or domain.endswith((".example", ".invalid", ".test", ".local"))
        or domain in {"example.com", "example.org", "example.net"}
    ):
        errors.add("DOMAIN")
    expected = {
        "DJANGO_DEBUG": "False",
        "DJANGO_SETTINGS_MODULE": "config.settings.production",
        "DJANGO_ALLOWED_HOSTS": domain,
        "DJANGO_CSRF_TRUSTED_ORIGINS": values.get("NEXT_PUBLIC_SITE_URL", ""),
        "API_INTERNAL_URL": "http://api:8000",
        "API_PORT": "8000",
        "WEB_PORT": "3000",
        "POSTGRES_PORT": "5432",
    }
    errors.update(
        key
        for key, expected_value in expected.items()
        if values.get(key) != expected_value
    )
    if values.get("NEXT_PUBLIC_SITE_URL") not in {
        f"https://{domain}",
        "https://fincamamasgarden.com",
        "https://www.fincamamasgarden.com",
        "https://surco-finca.web.app",
        "https://surco-finca.firebaseapp.com",
    }:
        errors.add("NEXT_PUBLIC_SITE_URL")
    for key, minimum in (("DJANGO_SECRET_KEY", 64), ("POSTGRES_PASSWORD", 32)):
        if not strong_secret(values.get(key, ""), minimum):
            errors.add(key)
    if values.get("DJANGO_SECRET_KEY") == values.get("POSTGRES_PASSWORD"):
        errors.update({"DJANGO_SECRET_KEY", "POSTGRES_PASSWORD"})
    for key in ("POSTGRES_DB", "POSTGRES_USER"):
        if not re.fullmatch(r"[a-z][a-z0-9_]{2,62}", values.get(key, "")):
            errors.add(key)
    if values.get("POSTGRES_USER") in {"postgres", "admin", "root"}:
        errors.add("POSTGRES_USER")
    try:
        database = urlsplit(values.get("DATABASE_URL", ""))
        if not (
            database.scheme == "postgresql"
            and database.hostname == "db"
            and database.port == 5432
            and not database.query
            and not database.fragment
            and unquote(database.username or "") == values.get("POSTGRES_USER")
            and unquote(database.password or "") == values.get("POSTGRES_PASSWORD")
            and database.path == f"/{values.get('POSTGRES_DB')}"
        ):
            errors.add("DATABASE_URL")
    except ValueError:
        errors.add("DATABASE_URL")
    return sorted(errors)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path)
    args = parser.parse_args()
    try:
        values = read_env(args.env_file) if args.env_file else os.environ
        errors = validate_env(values)
    except (OSError, ValueError, UnicodeError):
        print("Entorno inválido: no se pudo validar el archivo.", file=sys.stderr)
        return 1
    if errors:
        print(
            "Entorno inválido; revisar variables: " + ", ".join(errors), file=sys.stderr
        )
        return 1
    print("Entorno de producción: válido (valores ocultos).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
