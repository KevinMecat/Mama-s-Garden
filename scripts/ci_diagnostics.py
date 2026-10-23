"""CI-only container diagnostics with all fixture values redacted."""

import subprocess

from verify_prod_env import read_env

fixture = read_env(".env.ci")
result = subprocess.run(
    [
        "docker",
        "compose",
        "--env-file",
        ".env.ci",
        "-f",
        "docker-compose.prod.yml",
        "logs",
        "--no-color",
        "--tail",
        "80",
    ],
    capture_output=True,
    text=True,
    check=False,
)
output = result.stdout + result.stderr
for value in sorted(set(fixture.values()), key=len, reverse=True):
    if len(value) >= 8:
        output = output.replace(value, "[REDACTED]")
print(output)
