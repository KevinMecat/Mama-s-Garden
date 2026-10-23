from decimal import Decimal
from pathlib import Path
from typing import ClassVar

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone
from django.utils.text import get_valid_filename

from modules.projects.models import Project

from .validators import validate_receipt_size


def receipt_upload_path(instance, filename):
    today = timezone.localdate()
    safe_name = get_valid_filename(Path(filename).name)
    return f"finance/receipts/{today:%Y/%m}/{safe_name}"


class FinancialCategory(models.Model):
    name = models.CharField("nombre", max_length=100, unique=True)
    description = models.TextField("descripción", blank=True)
    is_active = models.BooleanField("activa", default=True, db_index=True)
    created_at = models.DateTimeField("creada", auto_now_add=True)
    updated_at = models.DateTimeField("actualizada", auto_now=True)

    class Meta:
        ordering = ("name",)
        verbose_name = "categoría financiera"
        verbose_name_plural = "categorías financieras"

    def __str__(self):
        return self.name


class Transaction(models.Model):
    class Type(models.TextChoices):
        INCOME = "INCOME", "Ingreso"
        EXPENSE = "EXPENSE", "Gasto operativo"
        INVESTMENT = "INVESTMENT", "Inversión"

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Borrador"
        POSTED = "POSTED", "Contabilizado"
        VOID = "VOID", "Anulado"

    project = models.ForeignKey(
        Project,
        on_delete=models.PROTECT,
        related_name="transactions",
        verbose_name="proyecto",
    )
    category = models.ForeignKey(
        FinancialCategory,
        on_delete=models.PROTECT,
        related_name="transactions",
        verbose_name="categoría",
    )
    type = models.CharField("tipo", max_length=16, choices=Type.choices, db_index=True)
    status = models.CharField(
        "estado",
        max_length=12,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    amount = models.DecimalField(
        "monto",
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    transaction_date = models.DateField("fecha de transacción", db_index=True)
    description = models.TextField("descripción", blank=True)
    supplier_or_customer = models.CharField(
        "proveedor o cliente",
        max_length=160,
        blank=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_transactions",
        verbose_name="creada por",
    )
    created_at = models.DateTimeField("creada", auto_now_add=True)
    updated_at = models.DateTimeField("actualizada", auto_now=True)

    class Meta:
        ordering = ("-transaction_date", "-created_at")
        verbose_name = "transacción"
        verbose_name_plural = "transacciones"
        indexes: ClassVar[list] = [
            models.Index(
                fields=("project", "status", "-transaction_date"),
                name="finance_project_status_date",
            )
        ]
        constraints: ClassVar[list] = [
            models.CheckConstraint(
                condition=models.Q(amount__gt=0),
                name="finance_transaction_amount_positive",
            )
        ]

    def __str__(self):
        return f"{self.get_type_display()} · {self.amount} · {self.project.name}"


class TransactionAttachment(models.Model):
    transaction = models.ForeignKey(
        Transaction,
        on_delete=models.CASCADE,
        related_name="attachments",
        verbose_name="transacción",
    )
    file = models.ImageField(
        "archivo",
        upload_to=receipt_upload_path,
        validators=[validate_receipt_size],
    )
    original_name = models.CharField("nombre original", max_length=255, editable=False)
    content_type = models.CharField("tipo de contenido", max_length=100, blank=True, editable=False)
    size = models.PositiveBigIntegerField("tamaño", default=0, editable=False)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="transaction_attachments",
        verbose_name="subido por",
    )
    uploaded_at = models.DateTimeField("subido", auto_now_add=True)

    class Meta:
        ordering = ("-uploaded_at",)
        verbose_name = "comprobante"
        verbose_name_plural = "comprobantes"

    def __str__(self):
        return self.original_name
