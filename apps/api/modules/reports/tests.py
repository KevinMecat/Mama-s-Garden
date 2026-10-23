from datetime import date
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from modules.accounts.models import User
from modules.finance.models import FinancialCategory, Transaction
from modules.payroll.models import Employee, SalaryRate, WorkEntry
from modules.production.models import Product, Sale
from modules.projects.models import Project, ProjectMember

from .services import build_dashboard_report


@pytest.fixture
def report_setup():
    administrator = User.objects.create_superuser(
        email="reports-admin@example.com", password="una-clave-segura"
    )
    worker = User.objects.create_user(
        email="reports-worker@example.com", password="una-clave-segura"
    )
    category = FinancialCategory.objects.create(name="Categoría aislada de reportes")
    active = Project.objects.create(
        name="Proyecto activo aislado",
        type=Project.Type.POULTRY_PRODUCTION,
        status=Project.Status.ACTIVE,
    )
    hidden = Project.objects.create(
        name="Proyecto sin acceso",
        type=Project.Type.INFRASTRUCTURE,
        status=Project.Status.ACTIVE,
    )
    ProjectMember.objects.create(project=active, user=worker)
    return administrator, worker, category, active, hidden


@pytest.mark.django_db
def test_empty_dashboard_report_has_safe_zero_values():
    administrator = User.objects.create_superuser(
        email="empty-reports@example.com", password="una-clave-segura"
    )
    report = build_dashboard_report(administrator, today=date(2026, 9, 3))

    assert report["kpis"]["month_income"] == "0.00"
    assert report["kpis"]["month_expenses"] == "0.00"
    assert report["kpis"]["pending_payroll"]["amount"] == "0.00"
    assert len(report["cash_flow"]) == 12
    assert all(row["income"] == row["expenses"] == "0.00" for row in report["cash_flow"])
    assert report["active_profitability"] == []
    assert report["cost_distribution"] == []


@pytest.mark.django_db
def test_dashboard_aggregates_only_posted_operating_transactions(report_setup):
    administrator, _, category, active, _ = report_setup
    product = Product.objects.create(name="Producto aislado", unit_of_measure="unidad")
    income = Transaction.objects.create(
        project=active,
        category=category,
        type=Transaction.Type.INCOME,
        status=Transaction.Status.POSTED,
        amount=Decimal("500.00"),
        transaction_date=date(2026, 9, 2),
        created_by=administrator,
    )
    Sale.objects.create(
        project=active,
        product=product,
        sale_date=date(2026, 9, 2),
        quantity=Decimal("10"),
        unit_price=Decimal("50"),
        transaction=income,
    )
    for transaction_type, status, amount in (
        (Transaction.Type.EXPENSE, Transaction.Status.POSTED, "180.00"),
        (Transaction.Type.EXPENSE, Transaction.Status.DRAFT, "90.00"),
        (Transaction.Type.INVESTMENT, Transaction.Status.POSTED, "1000.00"),
    ):
        Transaction.objects.create(
            project=active,
            category=category,
            type=transaction_type,
            status=status,
            amount=Decimal(amount),
            transaction_date=date(2026, 9, 2),
            created_by=administrator,
        )

    report = build_dashboard_report(administrator, today=date(2026, 9, 3))

    assert report["kpis"]["month_income"] == "500.00"
    assert report["kpis"]["month_expenses"] == "180.00"
    assert report["active_profitability"][0]["operating_cost"] == "180.00"
    assert report["active_profitability"][0]["confirmed_sales"] == "500.00"
    assert report["active_profitability"][0]["operating_result"] == "320.00"
    assert report["cost_distribution"][0]["percentage"] == "100.00"


@pytest.mark.django_db
def test_pending_payroll_counts_unlocked_attendance_without_crashing_on_missing_rates(report_setup):
    administrator, _, _, active, _ = report_setup
    employee = Employee.objects.create(
        first_name="Con", last_name="Tarifa", hire_date=date(2026, 1, 1)
    )
    missing_rate = Employee.objects.create(
        first_name="Sin", last_name="Tarifa", hire_date=date(2026, 1, 1)
    )
    SalaryRate.objects.create(
        employee=employee, daily_rate=Decimal("120.00"), valid_from=date(2026, 1, 1)
    )
    for person in (employee, missing_rate):
        WorkEntry.objects.create(
            employee=person,
            project=active,
            work_date=date(2026, 9, 2),
            status=WorkEntry.Status.HALF_DAY,
            created_by=administrator,
        )

    report = build_dashboard_report(administrator, today=date(2026, 9, 3))

    assert report["kpis"]["pending_payroll"] == {
        "amount": "60.00",
        "missing_rate_entries": 1,
    }


@pytest.mark.django_db
def test_worker_report_is_limited_to_assigned_projects(report_setup):
    administrator, worker, category, active, hidden = report_setup
    for project, amount in ((active, "25.00"), (hidden, "75.00")):
        Transaction.objects.create(
            project=project,
            category=category,
            type=Transaction.Type.EXPENSE,
            status=Transaction.Status.POSTED,
            amount=Decimal(amount),
            transaction_date=date(2026, 9, 2),
            created_by=administrator,
        )
    report = build_dashboard_report(worker, today=date(2026, 9, 3))

    assert report["kpis"]["month_expenses"] == "25.00"
    assert report["permissions"]["can_view_payroll"] is False
    assert report["kpis"]["pending_payroll"] is None
    assert [row["project"] for row in report["active_profitability"]] == [active.id]


@pytest.mark.django_db
def test_dashboard_endpoint_requires_authentication(report_setup):
    administrator, *_ = report_setup
    client = APIClient()
    assert client.get("/api/v1/reports/dashboard/").status_code in {401, 403}
    client.force_authenticate(administrator)
    response = client.get("/api/v1/reports/dashboard/")
    assert response.status_code == 200
    assert response.json()["period"]["cash_flow_months"] == 12
