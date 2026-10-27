import hashlib
from datetime import date

import pytest
from django.core.files.base import ContentFile
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


@pytest.mark.django_db(transaction=True)
def test_additive_migration_preserves_existing_records_and_receipt(tmp_path, settings):
    # Explicit safeguard: never run schema operations against an application database.
    database = str(connection.settings_dict["NAME"])
    assert database == ":memory:" or "memorydb" in database or "test" in database
    settings.MEDIA_ROOT = str(tmp_path)
    executor = MigrationExecutor(connection)
    targets = executor.loader.graph.leaf_nodes()
    executor.migrate([("workforce", None)])
    try:
        from modules.accounts.models import User
        from modules.finance.models import FinancialCategory, Transaction, TransactionAttachment
        from modules.payroll.models import (
            Employee,
            PayrollExpense,
            PayrollLine,
            PayrollPeriod,
            SalaryRate,
            WorkEntry,
        )
        from modules.projects.models import Project, ProjectMember

        actor = User.objects.create(email="synthetic-migration@isolated.example", role="ADMIN")
        project = Project.objects.create(name="Datos representativos", type="infraestructura")
        ProjectMember.objects.create(project=project, user=actor)
        person = Employee.objects.create(
            first_name="Sintético", last_name="A", hire_date=date(2026, 1, 1)
        )
        SalaryRate.objects.create(employee=person, daily_rate="123.45", valid_from=date(2026, 1, 1))
        WorkEntry.objects.create(
            employee=person,
            project=project,
            status="PRESENT",
            work_date=date(2026, 10, 26),
            created_by=actor,
        )
        category = FinancialCategory.objects.create(name="Conservación sintética")
        payment = Transaction.objects.create(
            project=project,
            category=category,
            type="EXPENSE",
            status="POSTED",
            amount="123.45",
            transaction_date=date(2026, 10, 26),
            created_by=actor,
        )
        period = PayrollPeriod.objects.create(
            start_date=date(2026, 10, 26),
            end_date=date(2026, 10, 26),
            status="PAID",
            category=category,
        )
        PayrollLine.objects.create(
            period=period, employee=person, project=project, worked_days="1", gross_amount="123.45"
        )
        PayrollExpense.objects.create(
            period=period, project=project, transaction=payment, amount="123.45"
        )
        receipt = TransactionAttachment.objects.create(
            transaction=payment,
            file=ContentFile(b"synthetic receipt, no personal data", name="receipt.png"),
            original_name="receipt.png",
            uploaded_by=actor,
            size=35,
        )
        models = [
            User,
            Project,
            ProjectMember,
            Employee,
            SalaryRate,
            WorkEntry,
            FinancialCategory,
            Transaction,
            TransactionAttachment,
            PayrollPeriod,
            PayrollLine,
            PayrollExpense,
        ]
        before = {model: list(model.objects.order_by("pk").values()) for model in models}
        with receipt.file.open("rb") as stream:
            digest = hashlib.sha256(stream.read()).digest()
        MigrationExecutor(connection).migrate(targets)
        for model in models:
            assert list(model.objects.order_by("pk").values()) == before[model]
        receipt.refresh_from_db()
        with receipt.file.open("rb") as stream:
            assert hashlib.sha256(stream.read()).digest() == digest
        from .models import EmployeeAccount, Task

        assert not Task.objects.exists() and not EmployeeAccount.objects.exists()
    finally:
        MigrationExecutor(connection).migrate(targets)
