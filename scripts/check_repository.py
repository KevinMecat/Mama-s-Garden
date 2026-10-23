"""Validate Git policy without displaying secret values."""

import re
import subprocess
import sys
from pathlib import Path, PurePosixPath

SUBJECT = re.compile(
    r"(feat|fix|refactor|docs|chore|style|test|perf)"
    r"\((root|ui|api|auth|db|docker|config)\): \S.*"
)
BRANCH = re.compile(r"(?:feat|fix|chore)/[a-z0-9]+(?:-[a-z0-9]+)*")


def git(*args):
    return subprocess.check_output(["git", *args]).decode("utf-8").strip()


def check_subject(subject):
    if not SUBJECT.fullmatch(subject) or subject != subject.lower():
        raise SystemExit("Cabecera inválida: consultar CONTRIBUTING.md.")


def main():
    if len(sys.argv) == 3 and sys.argv[1] == "--commit-msg":
        check_subject(Path(sys.argv[2]).read_text(encoding="utf-8").splitlines()[0])
        return
    branch = git("branch", "--show-current")
    if "--ci" not in sys.argv and branch != "main" and not BRANCH.fullmatch(branch):
        raise SystemExit("Nombre de rama inválido: consultar CONTRIBUTING.md.")
    forbidden_dirs = {
        "node_modules",
        "venv",
        ".venv",
        "__pycache__",
        ".next",
        "dist",
        "build",
        "coverage",
    }
    paths = set(git("ls-files", "-z").split("\0"))
    for commit in git("rev-list", "--all").splitlines():
        check_subject(git("show", "-s", "--format=%s", commit))
        paths.update(git("ls-tree", "-r", "--name-only", "-z", commit).split("\0"))
    rejected = []
    for name in paths - {""}:
        path = PurePosixPath(name.lower())
        if (
            path.name == ".env"
            or path.name.startswith(".env.")
            or path.suffix
            in {
                ".env",
                ".pem",
                ".key",
                ".p12",
                ".pfx",
                ".sqlite3",
                ".sqlite",
                ".db",
                ".log",
            }
            or forbidden_dirs.intersection(path.parts)
        ):
            rejected.append(name)
    if rejected:
        raise SystemExit(
            "Rutas prohibidas en índice/historial: " + ", ".join(sorted(rejected))
        )
    print("Políticas de ramas, commits y rutas: correctas.")


if __name__ == "__main__":
    main()
