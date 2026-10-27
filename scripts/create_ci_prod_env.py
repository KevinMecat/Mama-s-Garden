"""Generate ephemeral CI credentials. Does not print or contact production."""

import os
import secrets
from pathlib import Path

from verify_prod_env import read_env, validate_env

values = read_env(Path(__file__).resolve().parents[1] / "config/production.example")
values["DJANGO_SECRET_KEY"] = secrets.token_urlsafe(64)
values["POSTGRES_PASSWORD"] = secrets.token_urlsafe(36)
values["DATABASE_URL"] = (
    f"postgresql://{values['POSTGRES_USER']}:{values['POSTGRES_PASSWORD']}"
    f"@db:5432/{values['POSTGRES_DB']}"
)
if validate_env(values):
    raise SystemExit("Fixture de CI inválida.")
destination = Path(".env.ci")
descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
    stream.write("\n".join(f"{key}={value}" for key, value in values.items()) + "\n")
print("Fixture efímera de CI creada; valores ocultos.")
