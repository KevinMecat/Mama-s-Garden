import contextlib
import io
import secrets
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from scripts.verify_prod_env import read_env, validate_env

ROOT = Path(__file__).resolve().parents[2]


def fixture():
    values = read_env(ROOT / "config/production.example")
    values["DJANGO_SECRET_KEY"] = secrets.token_urlsafe(64)
    values["POSTGRES_PASSWORD"] = secrets.token_urlsafe(36)
    values["DATABASE_URL"] = (
        f"postgresql://{values['POSTGRES_USER']}:{values['POSTGRES_PASSWORD']}"
        f"@db:5432/{values['POSTGRES_DB']}"
    )
    return values


class ProductionEnvironmentTests(unittest.TestCase):
    def test_valid_and_missing_variables(self):
        values = fixture()
        self.assertEqual(validate_env(values), [])
        for key in read_env(ROOT / "config/environment.example"):
            with self.subTest(key=key):
                reduced = values.copy()
                reduced.pop(key)
                self.assertIn(key, validate_env(reduced))

    def test_weak_defaults_and_untrusted_origins(self):
        for key, value in (
            ("DJANGO_SECRET_KEY", "django-insecure-placeholder"),
            ("POSTGRES_PASSWORD", "password" * 8),
            ("DJANGO_DEBUG", "True"),
            ("DJANGO_ALLOWED_HOSTS", "*"),
            ("DOMAIN", "example.com"),
            ("DJANGO_CSRF_TRUSTED_ORIGINS", "http://fincamamasgarden.com"),
            ("API_INTERNAL_URL", "http://attacker.invalid"),
            ("DATABASE_URL", "postgresql://user:password@public.invalid:5432/db"),
        ):
            with self.subTest(key=key):
                values = fixture()
                values[key] = value
                self.assertIn(key, validate_env(values))

    def test_no_secret_values_on_stdout_or_stderr(self):
        values = fixture()
        values["DJANGO_DEBUG"] = "True"
        with tempfile.TemporaryDirectory() as directory:
            env_file = Path(directory) / "fixture"
            env_file.write_text(
                "\n".join(f"{key}={value}" for key, value in values.items())
            )
            output = subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "scripts/verify_prod_env.py"),
                    "--env-file",
                    str(env_file),
                ],
                capture_output=True,
                check=False,
            )
        self.assertEqual(output.returncode, 1)
        combined = output.stdout + output.stderr
        for key in ("DJANGO_SECRET_KEY", "POSTGRES_PASSWORD", "DATABASE_URL"):
            self.assertNotIn(values[key].encode(), combined)

    def test_env_is_data_and_not_executable(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "fixture"
            for content in ("KEY=$(whoami)", "KEY=`whoami`", "KEY=first\nKEY=second"):
                path.write_text(content)
                with (
                    self.assertRaises(ValueError),
                    contextlib.redirect_stdout(io.StringIO()),
                ):
                    read_env(path)


if __name__ == "__main__":
    unittest.main()
