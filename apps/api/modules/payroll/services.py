from collections import defaultdict
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction as database_transaction
from django.utils import timezone

from modules.finance.models import FinancialCategory, Transaction

from .models import PayrollExpense, PayrollLine, PayrollPeriod, SalaryRate, WorkEntry

MONEY_PLACES = Decimal("0.01")
DAY_PLACES = Decimal("0.1")


class PayrollCalculationError(Exception):
    pass


def _money(value):
    return Decimal(value).quantize(MONEY_PLACES, rounding=ROUND_HALF_UP)


def _find_rate(rates, work_date):
    for rate in rates:
        if rate.valid_from <= work_date and (rate.valid_to is None or rate.valid_to >= work_date):
            return rate
    return None


def calculate_payroll_values(period):
    entries = list(
        WorkEntry.objects.filter(
            work_date__gte=period.start_date,
            work_date__lte=period.end_date,
        )
        .exclude(status=WorkEntry.Status.ABSENT)
        .select_related("employee", "project")
        .order_by("work_date", "employee_id")
    )
    if not entries:
        raise PayrollCalculationError("No hay días trabajados dentro de este período.")

    employee_ids = {entry.employee_id for entry in entries}
    rates_by_employee = defaultdict(list)
    for rate in SalaryRate.objects.filter(employee_id__in=employee_ids).order_by(
        "employee_id", "-valid_from"
    ):
        rates_by_employee[rate.employee_id].append(rate)

    grouped = {}
    missing_rates = set()
    for entry in entries:
        rate = _find_rate(rates_by_employee[entry.employee_id], entry.work_date)
        if rate is None:
            missing_rates.add(entry.employee.full_name)
            continue
        key = (entry.employee_id, entry.project_id)
        row = grouped.setdefault(
            key,
            {
                "employee": entry.employee,
                "project": entry.project,
                "worked_days": Decimal("0.0"),
                "gross_amount": Decimal("0.00"),
            },
        )
        row["worked_days"] += entry.day_fraction
        row["gross_amount"] += _money(rate.daily_rate * entry.day_fraction)

    if missing_rates:
        names = ", ".join(sorted(missing_rates))
        raise PayrollCalculationError(f"Falta una tarifa salarial vigente para: {names}.")

    return list(grouped.values())


def serialize_payroll_values(values):
    employee_totals = {}
    project_totals = {}
    grand_total = Decimal("0.00")

    for value in values:
        employee = value["employee"]
        project = value["project"]
        worked_days = Decimal(value["worked_days"]).quantize(DAY_PLACES)
        gross_amount = _money(value["gross_amount"])
        grand_total += gross_amount

        employee_row = employee_totals.setdefault(
            employee.id,
            {
                "employee": employee.id,
                "employee_name": employee.full_name,
                "worked_days": Decimal("0.0"),
                "total_amount": Decimal("0.00"),
            },
        )
        employee_row["worked_days"] += worked_days
        employee_row["total_amount"] += gross_amount

        project_row = project_totals.setdefault(
            project.id,
            {
                "project": project.id,
                "project_name": project.name,
                "total_amount": Decimal("0.00"),
            },
        )
        project_row["total_amount"] += gross_amount

    employees = [
        {
            **row,
            "worked_days": str(row["worked_days"].quantize(DAY_PLACES)),
            "total_amount": str(_money(row["total_amount"])),
        }
        for row in employee_totals.values()
    ]
    projects = [
        {**row, "total_amount": str(_money(row["total_amount"]))} for row in project_totals.values()
    ]
    employees.sort(key=lambda row: row["employee_name"])
    projects.sort(key=lambda row: row["project_name"])
    return {
        "employees": employees,
        "projects": projects,
        "grand_total": str(_money(grand_total)),
    }


def get_payroll_summary(period):
    if period.status == PayrollPeriod.Status.DRAFT:
        values = calculate_payroll_values(period)
    else:
        values = [
            {
                "employee": line.employee,
                "project": line.project,
                "worked_days": line.worked_days,
                "gross_amount": line.gross_amount,
            }
            for line in period.lines.select_related("employee", "project").all()
        ]
    return serialize_payroll_values(values)


def _ensure_no_locked_overlap(period):
    overlap = PayrollPeriod.objects.exclude(pk=period.pk).filter(
        status__in=(PayrollPeriod.Status.APPROVED, PayrollPeriod.Status.PAID),
        start_date__lte=period.end_date,
        end_date__gte=period.start_date,
    )
    if overlap.exists():
        raise PayrollCalculationError("El período se cruza con otra planilla aprobada o pagada.")


def _approve_locked_period(period, user):
    if period.status != PayrollPeriod.Status.DRAFT:
        return period
    _ensure_no_locked_overlap(period)
    values = calculate_payroll_values(period)
    PayrollLine.objects.bulk_create(
        [
            PayrollLine(
                period=period,
                employee=value["employee"],
                project=value["project"],
                worked_days=value["worked_days"],
                gross_amount=_money(value["gross_amount"]),
            )
            for value in values
        ]
    )
    period.status = PayrollPeriod.Status.APPROVED
    period.approved_by = user
    period.approved_at = timezone.now()
    period.save(update_fields=("status", "approved_by", "approved_at", "updated_at"))
    return period


@database_transaction.atomic
def approve_payroll_period(period, user):
    locked = PayrollPeriod.objects.select_for_update().get(pk=period.pk)
    return _approve_locked_period(locked, user)


@database_transaction.atomic
def pay_payroll_period(period, user, category):
    locked = PayrollPeriod.objects.select_for_update().get(pk=period.pk)
    if locked.status == PayrollPeriod.Status.PAID:
        return locked
    if not isinstance(category, FinancialCategory) or not category.is_active:
        raise PayrollCalculationError("Selecciona una categoría financiera activa.")

    _approve_locked_period(locked, user)
    project_totals = defaultdict(lambda: Decimal("0.00"))
    projects = {}
    for line in locked.lines.select_related("project").all():
        projects[line.project_id] = line.project
        project_totals[line.project_id] += line.gross_amount

    for project_id, amount in project_totals.items():
        total = _money(amount)
        transaction_record = Transaction.objects.create(
            project=projects[project_id],
            category=category,
            type=Transaction.Type.EXPENSE,
            status=Transaction.Status.POSTED,
            amount=total,
            transaction_date=locked.end_date,
            description=f"Planilla del {locked.start_date} al {locked.end_date}",
            supplier_or_customer="Personal de la finca",
            created_by=user,
        )
        PayrollExpense.objects.create(
            period=locked,
            project=projects[project_id],
            transaction=transaction_record,
            amount=total,
        )

    locked.category = category
    locked.status = PayrollPeriod.Status.PAID
    locked.paid_at = timezone.now()
    locked.save(update_fields=("category", "status", "paid_at", "updated_at"))
    return locked


def work_date_is_locked(work_date):
    return PayrollPeriod.objects.filter(
        status__in=(PayrollPeriod.Status.APPROVED, PayrollPeriod.Status.PAID),
        start_date__lte=work_date,
        end_date__gte=work_date,
    ).exists()
