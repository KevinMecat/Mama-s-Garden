from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Sum

from modules.finance.models import Transaction

from .models import ProductionRecord, Sale

MONEY_PLACES = Decimal("0.01")
QUANTITY_PLACES = Decimal("0.001")


def _money(value):
    return (value or Decimal("0")).quantize(MONEY_PLACES, rounding=ROUND_HALF_UP)


def _quantity(value):
    return (value or Decimal("0")).quantize(QUANTITY_PLACES, rounding=ROUND_HALF_UP)


def calculate_project_metrics(project):
    operating_expense = _money(
        Transaction.objects.filter(
            project=project,
            type=Transaction.Type.EXPENSE,
            status=Transaction.Status.POSTED,
        ).aggregate(total=Sum("amount"))["total"]
    )
    total_produced = _quantity(
        ProductionRecord.objects.filter(project=project).aggregate(total=Sum("quantity"))["total"]
    )
    confirmed_sales = _money(
        Sale.objects.filter(
            project=project,
            transaction__status=Transaction.Status.POSTED,
        ).aggregate(total=Sum("total_amount"))["total"]
    )
    unit_cost = (
        _money(operating_expense / total_produced) if total_produced > 0 else Decimal("0.00")
    )
    operating_result = _money(confirmed_sales - operating_expense)
    operating_roi = (
        (operating_result / operating_expense * Decimal("100")).quantize(
            MONEY_PLACES,
            rounding=ROUND_HALF_UP,
        )
        if operating_expense > 0
        else Decimal("0.00")
    )

    return {
        "project": project.id,
        "operating_expense": str(operating_expense),
        "total_produced": str(total_produced),
        "confirmed_sales": str(confirmed_sales),
        "unit_cost": str(unit_cost),
        "operating_result": str(operating_result),
        "operating_roi": str(operating_roi),
    }
