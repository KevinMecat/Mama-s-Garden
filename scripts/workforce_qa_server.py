"""Loopback-only browser QA with synthetic data in a fresh temporary SQLite database."""

import argparse
import os
import secrets
import sys
import tempfile
from datetime import date
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--confirm-isolated", action="store_true", required=True)
    args = parser.parse_args()
    if not args.confirm_isolated:
        parser.error("Only isolated QA is supported")
    with tempfile.TemporaryDirectory(prefix="mamas-workforce-qa-") as directory:
        os.environ.update(
            {
                "DATABASE_URL": "sqlite:///"
                + (Path(directory) / "qa.sqlite3").as_posix(),
                "DJANGO_SECRET_KEY": secrets.token_urlsafe(64),
                "DJANGO_SETTINGS_MODULE": "config.settings.local",
                "DJANGO_ALLOWED_HOSTS": "127.0.0.1,localhost,testserver",
            }
        )
        sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps/api"))
        import django

        django.setup()
        from django.conf import settings
        from django.core.management import call_command

        settings.MEDIA_ROOT = str(Path(directory) / "media")
        settings.PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
        settings.MIDDLEWARE = [
            "corsheaders.middleware.CorsMiddleware",
            *settings.MIDDLEWARE,
        ]
        settings.CORS_ALLOWED_ORIGINS = ["http://127.0.0.1:3002"]
        settings.CORS_ALLOW_CREDENTIALS = True
        settings.CSRF_TRUSTED_ORIGINS = ["http://127.0.0.1:3002"]
        call_command("migrate", verbosity=0)
        from modules.accounts.models import User
        from modules.payroll.models import Employee, WorkEntry
        from modules.projects.models import Project, ProjectMember
        from modules.workforce.models import EmployeeAccount
        from modules.workforce.services import save_plan

        admin = User.objects.create_superuser(
            email="qa-admin@isolated.example", password="test-only-workforce"
        )
        worker = User.objects.create_user(
            email="qa-worker@isolated.example", password="test-only-workforce"
        )
        project = Project.objects.create(
            name="Proyecto QA aislado", type="infraestructura", status="active"
        )
        ProjectMember.objects.create(project=project, user=worker)
        employee = Employee.objects.create(
            first_name="Persona", last_name="QA", hire_date=date(2026, 1, 1)
        )
        EmployeeAccount.objects.create(employee=employee, user=worker)
        WorkEntry.objects.create(
            employee=employee,
            project=project,
            work_date=date(2026, 10, 27),
            status="PRESENT",
            created_by=admin,
        )
        save_plan(
            None,
            {
                "title": "Revisar riego con texto extenso para comprobar las tarjetas en el teléfono",
                "activity": "Riego",
                "location": "Sector norte",
                "project": project,
                "scheduled_date": date(2026, 10, 27),
                "priority": "HIGH",
                "acceptance_criteria": "Sin fugas",
                "assignees": [employee],
                "estimated_minutes": 60,
            },
            admin,
        )
        print(
            "QA ready: synthetic data, temporary database, loopback only.", flush=True
        )
        call_command("runserver", "127.0.0.1:8218", use_reloader=False, verbosity=0)


if __name__ == "__main__":
    main()
