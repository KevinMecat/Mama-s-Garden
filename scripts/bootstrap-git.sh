#!/usr/bin/env bash
# Ejecutar desde la raíz en Git Bash; solo para un repositorio sin commits.
set -euo pipefail
remote='https://github.com/KevinMecat/Mama-s-Garden.git'
command -v python >/dev/null
command -v gitleaks >/dev/null
git init
if git rev-parse --verify HEAD >/dev/null 2>&1; then
  echo 'Ya existen commits. No repetir la inicialización.' >&2
  exit 1
fi
git var GIT_AUTHOR_IDENT >/dev/null
if git remote get-url origin >/dev/null 2>&1; then
  test "$(git remote get-url origin)" = "$remote"
else
  git remote add origin "$remote"
fi
remote_refs=$(git ls-remote origin)
test -z "$remote_refs" || { echo 'El remoto contiene referencias; detener y revisar.' >&2; exit 1; }
git branch -M main
git config core.hooksPath .githooks
git add --all
git update-index --chmod=+x .githooks/commit-msg .githooks/pre-push scripts/bootstrap-git.sh
git status --short
git diff --cached --stat
python scripts/check_repository.py
gitleaks git . --pre-commit --staged --redact --no-banner --max-archive-depth=3
git commit -m 'chore(root): initialize project structure and setup'
git branch -M main
gitleaks git . --redact --no-banner --max-archive-depth=3 --log-opts="--all"
git push -u origin main
git switch -c chore/environment-setup
