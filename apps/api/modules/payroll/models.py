from decimal import Decimal
from typing import ClassVar

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models

from modules.finance.models import FinancialCategory, Transaction
from modules.projects.models import Project


class Employee(models.Model):
    first_name = models.CharField("nombres", max_length=100)
    last_name = models.CharField("apellidos", max_length=100)
    phone = models.CharField("teléfono", max_length=30, blank=True)
    hire_date = models.DateField("fecha de contratación")
    is_active = models.BooleanField("activo", default=True, db_index=True)
    created_at = models.DateTimeField("creado", auto_now_add=True)
    updated_at = models.DateTimeField("actualizado", auto_now=True)

    class Meta:
        ordering = ("first_name", "last_name", "id")
        verbose_name = "empleado"
        verbose_name_plural = "empleados"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def __str__(self):
        return self.full_name


class SalaryRate(models.Model):
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name="salary_rates",
        verbose_name="empleado",
    )
    daily_rate = models.DecimalField(
        "salario diario",
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    valid_from = models.DateField("vigente desde")
    valid_to = models.DateField("vigente hasta", null=True, blank=True)
    created_at = models.DateTimeField("creada", auto_now_add=True)
    updated_at = models.DateTimeField("actualizada", auto_now=True)

    class Meta:
        ordering = ("-valid_from", "-id")
        verbose_name = "tarifa salarial"
        verbose_name_plural = "tarifas salariales"
        constraints: ClassVar[list] = [
            models.UniqueConstraint(
                fields=("employee", "valid_from"),
                name="payroll_unique_employee_rate_start",
            ),
            models.CheckConstraint(
                condition=models.Q(valid_to__isnull=True)
                | models.Q(valid_to__gte=models.F("valid_from")),
                name="payroll_salary_rate_valid_range",
            ),
            models.CheckConstraint(
                condition=models.Q(daily_rate__gt=0),
                name="payroll_salary_rate_positive",
            ),
        ]

    def clean(self):
        super().clean()
        if self.valid_to and self.valid_to < self.valid_from:
            raise ValidationError(
                {"valid_to": "La fecha final no puede ser anterior a la fecha inicial."}
            )

    def __str__(self):
        return f"{self.employee.full_name} · {self.daily_rate} desde {self.valid_from}"


class WorkEntry(models.Model):
    class Status(models.TextChoices):
        PRESENT = "PRESENT", "Presente"
        ABSENT = "ABSENT", "Ausente"
        HALF_DAY = "HALF_DAY", "Medio día"

    STATUS_FRACTIONS: ClassVar[dict] = {
        Status.PRESENT: Decimal("1.0"),
        Status.ABSENT: Decimal("0.0"),
        Status.HALF_DAY: Decimal("0.5"),
    }

    employee = models.ForeignKey(
        Employee,
        on_delete=models.PROTECT,
        related_name="work_entries",
        verbose_name="empleado",
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.PROTECT,
        related_name="work_entries",
        verbose_name="proyecto",
    )
    work_date = models.DateField("fecha de trabajo", db_index=True)
    status = models.CharField("estado", max_length=12, choices=Status.choices)
    day_fraction = models.DecimalField(
        "fracción del día",
        max_digits=2,
        decimal_places=1,
        editable=False,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_work_entries",
        verbose_name="registrado por",
    )
    created_at = models.DateTimeField("creada", auto_now_add=True)
    updated_at = models.DateTimeField("actualizada", auto_now=True)

    class Meta:
        ordering = ("-work_date", "employee__first_name", "employee__last_name")
        verbose_name = "asistencia"
        verbose_name_plural = "asistencias"
        constraints: ClassVar[list] = [
            models.UniqueConstraint(
                fields=("employee", "work_date"),
                name="payroll_unique_employee_work_date",
            ),
            models.CheckConstraint(
                condition=models.Q(
                    day_fraction__in=(Decimal("0.0"), Decimal("0.5"), Decimal("1.0"))
                ),
                name="payroll_valid_day_fraction",
            ),
        ]

    def save(self, *args, **kwargs):
        self.day_fraction = self.STATUS_FRACTIONS[self.status]
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.employee.full_name} · {self.work_date} · {self.get_status_display()}"


class PayrollPeriod(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Borrador"
        APPROVED = "APPROVED", "Aprobada"
        PAID = "PAID", "Pagada"

    start_date = models.DateField("fecha inicial")
    end_date = models.DateField("fecha final")
    status = models.CharField(
        "estado",
        max_length=12,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    category = models.ForeignKey(
        FinancialCategory,
        on_delete=models.PROTECT,
        related_name="payroll_periods",
        verbose_name="categoría financiera",
        null=True,
        blank=True,
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="approved_payroll_periods",
        verbose_name="aprobada por",
        null=True,
        blank=True,
    )
    approved_at = models.DateTimeField("aprobada", null=True, blank=True)
    paid_at = models.DateTimeField("pagada", null=True, blank=True)
    created_at = models.DateTimeField("creada", auto_now_add=True)
    updated_at = models.DateTimeField("actualizada", auto_now=True)

    class Meta:
        ordering = ("-end_date", "-start_date", "-id")
        verbose_name = "período de planilla"
        verbose_name_plural = "períodos de planilla"
        constraints: ClassVar[list] = [
            models.UniqueConstraint(
                fields=("start_date", "end_date"),
                name="payroll_unique_period_range",
            ),
            models.CheckConstraint(
                condition=models.Q(end_date__gte=models.F("start_date")),
                name="payroll_period_valid_range",
            ),
        ]

    def __str__(self):
        return f"{self.start_date} al {self.end_date} · {self.get_status_display()}"


class PayrollLine(models.Model):
    period = models.ForeignKey(
        PayrollPeriod,
        on_delete=models.CASCADE,
        related_name="lines",
        verbose_name="período",
    )
    employee = models.ForeignKey(
        Employee,
        on_delete=models.PROTECT,
        related_name="payroll_lines",
        verbose_name="empleado",
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.PROTECT,
        related_name="payroll_lines",
        verbose_name="proyecto",
    )
    worked_days = models.DecimalField("días pagados", max_digits=7, decimal_places=1)
    gross_amount = models.DecimalField("monto bruto", max_digits=14, decimal_places=2)

    class Meta:
        ordering = ("employee__first_name", "employee__last_name", "project__name")
        verbose_name = "línea de planilla"
        verbose_name_plural = "líneas de planilla"
        constraints: ClassVar[list] = [
            models.UniqueConstraint(
                fields=("period", "employee", "project"),
                name="payroll_unique_employee_project_line",
            )
        ]


class PayrollExpense(models.Model):
    period = models.ForeignKey(
        PayrollPeriod,
        on_delete=models.CASCADE,
        related_name="expenses",
        verbose_name="período",
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.PROTECT,
        related_name="payroll_expenses",
        verbose_name="proyecto",
    )
    transaction = models.OneToOneField(
        Transaction,
        on_delete=models.PROTECT,
        related_name="payroll_expense",
        verbose_name="transacción financiera",
    )
    amount = models.DecimalField("monto", max_digits=14, decimal_places=2)

    class Meta:
        ordering = ("project__name",)
        verbose_name = "gasto de planilla"
        verbose_name_plural = "gastos de planilla"
        constraints: ClassVar[list] = [
            models.UniqueConstraint(
                fields=("period", "project"),
                name="payroll_unique_period_project_expense",
            )
        ]
