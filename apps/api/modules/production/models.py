from decimal import ROUND_HALF_UP, Decimal
from typing import ClassVar

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from modules.finance.models import Transaction
from modules.projects.models import Project


class Product(models.Model):
    name = models.CharField("nombre", max_length=120, unique=True)
    unit_of_measure = models.CharField("unidad de medida", max_length=50)
    is_active = models.BooleanField("activo", default=True, db_index=True)
    created_at = models.DateTimeField("creado", auto_now_add=True)
    updated_at = models.DateTimeField("actualizado", auto_now=True)

    class Meta:
        ordering = ("name",)
        verbose_name = "producto"
        verbose_name_plural = "productos"

    def __str__(self):
        return f"{self.name} ({self.unit_of_measure})"


class ProductionRecord(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.PROTECT,
        related_name="production_records",
        verbose_name="proyecto",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="production_records",
        verbose_name="producto",
    )
    production_date = models.DateField("fecha de producción", db_index=True)
    quantity = models.DecimalField(
        "cantidad",
        max_digits=14,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0.001"))],
    )
    notes = models.TextField("notas", blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_production_records",
        verbose_name="creado por",
    )
    created_at = models.DateTimeField("creado", auto_now_add=True)
    updated_at = models.DateTimeField("actualizado", auto_now=True)

    class Meta:
        ordering = ("-production_date", "-created_at")
        verbose_name = "registro de producción"
        verbose_name_plural = "registros de producción"
        indexes: ClassVar[list] = [
            models.Index(
                fields=("project", "-production_date"),
                name="production_project_date",
            )
        ]
        constraints: ClassVar[list] = [
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0),
                name="production_record_quantity_positive",
            )
        ]

    def __str__(self):
        return f"{self.product.name} · {self.quantity} · {self.project.name}"


class Sale(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.PROTECT,
        related_name="sales",
        verbose_name="proyecto",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="sales",
        verbose_name="producto",
    )
    sale_date = models.DateField("fecha de venta", db_index=True)
    quantity = models.DecimalField(
        "cantidad",
        max_digits=14,
        decimal_places=3,
        validators=[MinValueValidator(Decimal("0.001"))],
    )
    unit_price = models.DecimalField(
        "precio unitario",
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    total_amount = models.DecimalField(
        "monto total",
        max_digits=16,
        decimal_places=2,
        editable=False,
    )
    customer = models.CharField("cliente", max_length=160, blank=True)
    transaction = models.OneToOneField(
        Transaction,
        on_delete=models.PROTECT,
        related_name="sale",
        verbose_name="transacción financiera",
    )
    created_at = models.DateTimeField("creada", auto_now_add=True)
    updated_at = models.DateTimeField("actualizada", auto_now=True)

    class Meta:
        ordering = ("-sale_date", "-created_at")
        verbose_name = "venta"
        verbose_name_plural = "ventas"
        indexes: ClassVar[list] = [
            models.Index(fields=("project", "-sale_date"), name="sale_project_date")
        ]
        constraints: ClassVar[list] = [
            models.CheckConstraint(
                condition=models.Q(quantity__gt=0),
                name="sale_quantity_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(unit_price__gt=0),
                name="sale_unit_price_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(total_amount__gt=0),
                name="sale_total_amount_positive",
            ),
        ]

    @staticmethod
    def calculate_total(quantity, unit_price):
        return (Decimal(quantity) * Decimal(unit_price)).quantize(
            Decimal("0.01"),
            rounding=ROUND_HALF_UP,
        )

    @property
    def status(self):
        return self.transaction.status

    def save(self, *args, **kwargs):
        self.total_amount = self.calculate_total(self.quantity, self.unit_price)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.product.name} · {self.total_amount} · {self.project.name}"
