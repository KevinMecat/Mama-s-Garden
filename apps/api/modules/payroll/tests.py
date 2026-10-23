from datetime import date
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from modules.accounts.models import User
from modules.finance.models import FinancialCategory, Transaction
from modules.projects.models import Project, ProjectMember

from .models import Employee, PayrollExpense, PayrollLine, PayrollPeriod, SalaryRate, WorkEntry


@pytest.fixture
def payroll_setup():
    administrator = User.objects.create_superuser(
        email="payroll-admin@example.com",
        password="una-clave-segura",
    )
    worker = User.objects.create_user(
        email="payroll-worker@example.com",
        password="una-clave-segura",
    )
    infrastructure = Project.objects.create(
        name="Infraestructura aislada",
        type=Project.Type.INFRASTRUCTURE,
        status=Project.Status.ACTIVE,
    )
    poultry = Project.objects.create(
        name="Avícola aislada",
        type=Project.Type.POULTRY_PRODUCTION,
        status=Project.Status.ACTIVE,
    )
    ProjectMember.objects.create(project=infrastructure, user=worker)
    employee = Employee.objects.create(
        first_name="Persona",
        last_name="Temporal",
        phone="",
        hire_date=date(2026, 1, 1),
    )
    SalaryRate.objects.create(
        employee=employee,
        daily_rate=Decimal("100.00"),
        valid_from=date(2026, 1, 1),
    )
    category = FinancialCategory.objects.create(name="Categoría aislada de nómina")
    return administrator, worker, infrastructure, poultry, employee, category


@pytest.mark.django_db
def test_payroll_tables_have_no_automatic_records():
    assert Employee.objects.count() == 0
    assert SalaryRate.objects.count() == 0
    assert WorkEntry.objects.count() == 0
    assert PayrollPeriod.objects.count() == 0


@pytest.mark.django_db
def test_employee_crud_is_admin_only(payroll_setup):
    administrator, worker, *_ = payroll_setup
    client = APIClient()
    client.force_authenticate(worker)
    denied = client.post(
        "/api/v1/payroll/employees/",
        {
            "first_name": "Sin",
            "last_name": "Permiso",
            "hire_date": "2026-09-01",
        },
        format="json",
    )
    assert denied.status_code == 403

    client.force_authenticate(administrator)
    created = client.post(
        "/api/v1/payroll/employees/",
        {
            "first_name": "Nuevo",
            "last_name": "Empleado",
            "phone": "5555-5555",
            "hire_date": "2026-09-01",
            "new_daily_rate": "90.00",
            "rate_valid_from": "2026-09-01",
        },
        format="json",
    )
    employee_id = created.json()["id"]
    updated = client.patch(
        f"/api/v1/payroll/employees/{employee_id}/",
        {"phone": "4444-4444"},
        format="json",
    )
    rate_exists = SalaryRate.objects.filter(
        employee_id=employee_id, daily_rate=Decimal("90.00")
    ).exists()
    deleted = client.delete(f"/api/v1/payroll/employees/{employee_id}/")

    assert created.status_code == 201
    assert updated.status_code == 200
    assert updated.json()["phone"] == "4444-4444"
    assert rate_exists
    assert deleted.status_code == 204


@pytest.mark.django_db
def test_new_salary_rate_closes_previous_rate(payroll_setup):
    administrator, _, _, _, employee, _ = payroll_setup
    client = APIClient()
    client.force_authenticate(administrator)

    response = client.post(
        "/api/v1/payroll/salary-rates/",
        {
            "employee": employee.id,
            "daily_rate": "125.00",
            "valid_from": "2026-02-01",
            "valid_to": None,
        },
        format="json",
    )

    assert response.status_code == 201, response.json()
    previous = SalaryRate.objects.get(employee=employee, valid_from=date(2026, 1, 1))
    assert previous.valid_to == date(2026, 1, 31)
    assert SalaryRate.objects.get(pk=response.json()["id"]).daily_rate == Decimal("125.00")


@pytest.mark.django_db
def test_bulk_attendance_derives_day_fraction_and_updates(payroll_setup):
    administrator, _, infrastructure, _, employee, _ = payroll_setup
    client = APIClient()
    client.force_authenticate(administrator)
    url = "/api/v1/payroll/work-entries/bulk/"

    present = client.post(
        url,
        {
            "work_date": "2026-09-01",
            "entries": [
                {
                    "employee": employee.id,
                    "project": infrastructure.id,
                    "status": WorkEntry.Status.PRESENT,
                }
            ],
        },
        format="json",
    )
    half_day = client.post(
        url,
        {
            "work_date": "2026-09-01",
            "entries": [
                {
                    "employee": employee.id,
                    "project": infrastructure.id,
                    "status": WorkEntry.Status.HALF_DAY,
                }
            ],
        },
        format="json",
    )

    assert present.status_code == 200
    assert present.json()[0]["day_fraction"] == "1.0"
    assert half_day.status_code == 200
    assert half_day.json()[0]["day_fraction"] == "0.5"
    assert WorkEntry.objects.count() == 1


@pytest.mark.django_db
def test_worker_cannot_charge_attendance_to_unassigned_project(payroll_setup):
    _, worker, _, poultry, employee, _ = payroll_setup
    client = APIClient()
    client.force_authenticate(worker)
    response = client.post(
        "/api/v1/payroll/work-entries/bulk/",
        {
            "work_date": "2026-09-01",
            "entries": [
                {
                    "employee": employee.id,
                    "project": poultry.id,
                    "status": WorkEntry.Status.PRESENT,
                }
            ],
        },
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_paying_payroll_creates_one_posted_expense_per_project(payroll_setup):
    administrator, _, infrastructure, poultry, employee, category = payroll_setup
    for day_number in range(1, 7):
        WorkEntry.objects.create(
            employee=employee,
            project=infrastructure if day_number <= 3 else poultry,
            work_date=date(2026, 9, day_number),
            status=WorkEntry.Status.PRESENT,
            created_by=administrator,
        )
    client = APIClient()
    client.force_authenticate(administrator)
    created = client.post(
        "/api/v1/payroll/periods/",
        {"start_date": "2026-09-01", "end_date": "2026-09-06"},
        format="json",
    )
    assert created.status_code == 201, created.json()
    period_id = created.json()["id"]
    assert created.json()["summary"]["grand_total"] == "600.00"

    paid = client.post(
        f"/api/v1/payroll/periods/{period_id}/pay/",
        {"category": category.id},
        format="json",
    )
    repeated = client.post(
        f"/api/v1/payroll/periods/{period_id}/pay/",
        {"category": category.id},
        format="json",
    )

    assert paid.status_code == 200, paid.json()
    assert paid.json()["status"] == PayrollPeriod.Status.PAID
    assert repeated.status_code == 200
    assert PayrollLine.objects.filter(period_id=period_id).count() == 2
    assert PayrollExpense.objects.filter(period_id=period_id).count() == 2
    expenses = Transaction.objects.filter(type=Transaction.Type.EXPENSE)
    assert expenses.count() == 2
    assert set(expenses.values_list("project_id", "amount")) == {
        (infrastructure.id, Decimal("300.00")),
        (poultry.id, Decimal("300.00")),
    }
    assert set(expenses.values_list("status", flat=True)) == {Transaction.Status.POSTED}

    locked_entry = WorkEntry.objects.order_by("work_date").first()
    update = client.patch(
        f"/api/v1/payroll/work-entries/{locked_entry.id}/",
        {"status": WorkEntry.Status.HALF_DAY},
        format="json",
    )
    assert update.status_code == 400


@pytest.mark.django_db
def test_half_day_and_historical_rates_are_calculated_by_work_date(payroll_setup):
    administrator, _, infrastructure, _, employee, category = payroll_setup
    current = SalaryRate.objects.get(employee=employee)
    current.valid_to = date(2026, 1, 31)
    current.save()
    SalaryRate.objects.create(
        employee=employee,
        daily_rate=Decimal("120.00"),
        valid_from=date(2026, 2, 1),
    )
    WorkEntry.objects.create(
        employee=employee,
        project=infrastructure,
        work_date=date(2026, 1, 31),
        status=WorkEntry.Status.HALF_DAY,
        created_by=administrator,
    )
    WorkEntry.objects.create(
        employee=employee,
        project=infrastructure,
        work_date=date(2026, 2, 1),
        status=WorkEntry.Status.PRESENT,
        created_by=administrator,
    )
    client = APIClient()
    client.force_authenticate(administrator)
    period = client.post(
        "/api/v1/payroll/periods/",
        {"start_date": "2026-01-31", "end_date": "2026-02-01"},
        format="json",
    )
    assert period.status_code == 201, period.json()
    assert period.json()["summary"]["grand_total"] == "170.00"

    paid = client.post(
        f"/api/v1/payroll/periods/{period.json()['id']}/pay/",
        {"category": category.id},
        format="json",
    )
    assert paid.status_code == 200
    assert Transaction.objects.get(
        payroll_expense__period_id=period.json()["id"]
    ).amount == Decimal("170.00")
