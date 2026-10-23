from collections import defaultdict
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from modules.accounts.models import User
from modules.finance.models import Transaction
from modules.payroll.models import PayrollLine, PayrollPeriod, SalaryRate, WorkEntry
from modules.production.models import Sale
from modules.projects.models import Project

MONEY_PLACES = Decimal("0.01")
PERCENT_PLACES = Decimal("0.01")
CASH_FLOW_MONTHS = 12


def _money(value):
    return (value or Decimal("0")).quantize(MONEY_PLACES, rounding=ROUND_HALF_UP)


def _month_start(value):
    return value.replace(day=1)


def _shift_month(value, months):
    month_index = value.year * 12 + value.month - 1 + months
    return date(month_index // 12, month_index % 12 + 1, 1)


def _project_ids_for(user):
    if user.role == User.Role.ADMINISTRATOR:
        return None
    return Project.objects.filter(memberships__user=user).values_list("id", flat=True)


def _financial_queryset(user):
    queryset = Transaction.objects.filter(status=Transaction.Status.POSTED)
    project_ids = _project_ids_for(user)
    if project_ids is not None:
        queryset = queryset.filter(project_id__in=project_ids)
    return queryset


def _monthly_cash_flow(queryset, today):
    current_month = _month_start(today)
    first_month = _shift_month(current_month, -(CASH_FLOW_MONTHS - 1))
    last_month = _shift_month(current_month, 1)
    rows = (
        queryset.filter(
            type__in=(Transaction.Type.INCOME, Transaction.Type.EXPENSE),
            transaction_date__gte=first_month,
            transaction_date__lt=last_month,
        )
        .annotate(month=TruncMonth("transaction_date"))
        .values("month", "type")
        .annotate(total=Sum("amount"))
    )
    totals = {(_month_start(row["month"]), row["type"]): _money(row["total"]) for row in rows}
    labels = ("ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic")
    result = []
    for offset in range(CASH_FLOW_MONTHS):
        month = _shift_month(first_month, offset)
        result.append(
            {
                "month": month.strftime("%Y-%m"),
                "label": f"{labels[month.month - 1]} {month.year}",
                "income": str(totals.get((month, Transaction.Type.INCOME), Decimal("0.00"))),
                "expenses": str(totals.get((month, Transaction.Type.EXPENSE), Decimal("0.00"))),
            }
        )
    return result


def _active_profitability(user):
    projects = Project.objects.filter(status=Project.Status.ACTIVE)
    project_ids = _project_ids_for(user)
    if project_ids is not None:
        projects = projects.filter(id__in=project_ids)
    projects = list(projects.order_by("name").values("id", "name"))
    ids = [project["id"] for project in projects]

    expenses = {
        row["project_id"]: _money(row["total"])
        for row in Transaction.objects.filter(
            project_id__in=ids,
            type=Transaction.Type.EXPENSE,
            status=Transaction.Status.POSTED,
        )
        .values("project_id")
        .annotate(total=Sum("amount"))
    }
    sales = {
        row["project_id"]: _money(row["total"])
        for row in Sale.objects.filter(
            project_id__in=ids,
            transaction__status=Transaction.Status.POSTED,
        )
        .values("project_id")
        .annotate(total=Sum("total_amount"))
    }

    return [
        {
            "project": project["id"],
            "project_name": project["name"],
            "operating_cost": str(expenses.get(project["id"], Decimal("0.00"))),
            "confirmed_sales": str(sales.get(project["id"], Decimal("0.00"))),
            "operating_result": str(
                _money(
                    sales.get(project["id"], Decimal("0.00"))
                    - expenses.get(project["id"], Decimal("0.00"))
                )
            ),
        }
        for project in projects
    ]


def _cost_distribution(queryset):
    rows = list(
        queryset.filter(type=Transaction.Type.EXPENSE)
        .values("category_id", "category__name")
        .annotate(total=Sum("amount"))
        .order_by("category__name")
    )
    grand_total = sum((_money(row["total"]) for row in rows), Decimal("0.00"))
    return [
        {
            "category": row["category_id"],
            "category_name": row["category__name"],
            "amount": str(_money(row["total"])),
            "percentage": str(
                (_money(row["total"]) / grand_total * Decimal("100")).quantize(
                    PERCENT_PLACES,
                    rounding=ROUND_HALF_UP,
                )
                if grand_total > 0
                else Decimal("0.00")
            ),
        }
        for row in rows
    ]


def _pending_payroll(today):
    approved_total = _money(
        PayrollLine.objects.filter(period__status=PayrollPeriod.Status.APPROVED).aggregate(
            total=Sum("gross_amount")
        )["total"]
    )
    locked_ranges = list(
        PayrollPeriod.objects.filter(
            status__in=(PayrollPeriod.Status.APPROVED, PayrollPeriod.Status.PAID)
        ).values_list("start_date", "end_date")
    )
    entries = list(
        WorkEntry.objects.filter(work_date__lte=today)
        .exclude(status=WorkEntry.Status.ABSENT)
        .select_related("employee")
    )
    entries = [
        entry
        for entry in entries
        if not any(start <= entry.work_date <= end for start, end in locked_ranges)
    ]
    rates_by_employee = defaultdict(list)
    for rate in SalaryRate.objects.filter(
        employee_id__in={entry.employee_id for entry in entries}
    ).order_by("employee_id", "-valid_from"):
        rates_by_employee[rate.employee_id].append(rate)

    live_total = Decimal("0.00")
    missing_rate_employees = set()
    for entry in entries:
        rate = next(
            (
                rate
                for rate in rates_by_employee[entry.employee_id]
                if rate.valid_from <= entry.work_date
                and (rate.valid_to is None or rate.valid_to >= entry.work_date)
            ),
            None,
        )
        if rate is None:
            missing_rate_employees.add(entry.employee_id)
            continue
        live_total += _money(rate.daily_rate * entry.day_fraction)

    return {
        "amount": str(_money(approved_total + live_total)),
        "missing_rate_entries": len(missing_rate_employees),
    }


def build_dashboard_report(user, today=None):
    today = today or timezone.localdate()
    transactions = _financial_queryset(user)
    month_start = _month_start(today)
    next_month = _shift_month(month_start, 1)
    current_month = transactions.filter(
        transaction_date__gte=month_start,
        transaction_date__lt=next_month,
    )
    month_totals = {
        row["type"]: _money(row["total"])
        for row in current_month.values("type").annotate(total=Sum("amount"))
    }
    can_view_payroll = user.role == User.Role.ADMINISTRATOR
    pending_payroll = _pending_payroll(today) if can_view_payroll else None

    return {
        "period": {
            "current_month": month_start.strftime("%Y-%m"),
            "cash_flow_months": CASH_FLOW_MONTHS,
        },
        "permissions": {"can_view_payroll": can_view_payroll},
        "kpis": {
            "month_income": str(month_totals.get(Transaction.Type.INCOME, Decimal("0.00"))),
            "month_expenses": str(month_totals.get(Transaction.Type.EXPENSE, Decimal("0.00"))),
            "pending_payroll": pending_payroll,
        },
        "cash_flow": _monthly_cash_flow(transactions, today),
        "active_profitability": _active_profitability(user),
        "cost_distribution": _cost_distribution(transactions),
    }
