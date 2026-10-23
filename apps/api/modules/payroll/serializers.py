from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace

from django.db import transaction as database_transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers

from modules.accounts.models import User
from modules.finance.models import FinancialCategory
from modules.projects.models import Project

from .models import Employee, PayrollPeriod, SalaryRate, WorkEntry
from .services import PayrollCalculationError, calculate_payroll_values, get_payroll_summary


class EmployeeSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    current_daily_rate = serializers.SerializerMethodField()
    new_daily_rate = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.01"),
        write_only=True,
        required=False,
    )
    rate_valid_from = serializers.DateField(write_only=True, required=False)

    class Meta:
        model = Employee
        fields = (
            "id",
            "first_name",
            "last_name",
            "full_name",
            "phone",
            "hire_date",
            "is_active",
            "current_daily_rate",
            "new_daily_rate",
            "rate_valid_from",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "full_name", "current_daily_rate", "created_at", "updated_at")

    def get_current_daily_rate(self, instance):
        today = timezone.localdate()
        rate = (
            instance.salary_rates.filter(valid_from__lte=today)
            .filter(Q(valid_to__isnull=True) | Q(valid_to__gte=today))
            .order_by("-valid_from")
            .first()
        )
        return str(rate.daily_rate) if rate else None

    def validate(self, attrs):
        new_daily_rate = attrs.get("new_daily_rate")
        rate_valid_from = attrs.get("rate_valid_from")
        if (new_daily_rate is None) != (rate_valid_from is None):
            raise serializers.ValidationError(
                "Indica juntos el nuevo salario diario y su fecha de vigencia."
            )
        return attrs

    def _create_rate(self, employee, daily_rate, valid_from):
        rate_serializer = SalaryRateSerializer(
            data={
                "employee": employee.pk,
                "daily_rate": daily_rate,
                "valid_from": valid_from,
                "valid_to": None,
            },
            context=self.context,
        )
        rate_serializer.is_valid(raise_exception=True)
        rate_serializer.save()

    @database_transaction.atomic
    def create(self, validated_data):
        daily_rate = validated_data.pop("new_daily_rate", None)
        valid_from = validated_data.pop("rate_valid_from", None)
        employee = super().create(validated_data)
        if daily_rate is not None:
            self._create_rate(employee, daily_rate, valid_from)
        return employee

    @database_transaction.atomic
    def update(self, instance, validated_data):
        daily_rate = validated_data.pop("new_daily_rate", None)
        valid_from = validated_data.pop("rate_valid_from", None)
        employee = super().update(instance, validated_data)
        if daily_rate is not None:
            self._create_rate(employee, daily_rate, valid_from)
        return employee


class SalaryRateSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)

    class Meta:
        model = SalaryRate
        fields = (
            "id",
            "employee",
            "employee_name",
            "daily_rate",
            "valid_from",
            "valid_to",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "employee_name", "created_at", "updated_at")

    def validate(self, attrs):
        employee = attrs.get("employee", getattr(self.instance, "employee", None))
        valid_from = attrs.get("valid_from", getattr(self.instance, "valid_from", None))
        valid_to = attrs.get("valid_to", getattr(self.instance, "valid_to", None))
        if valid_from and valid_to and valid_to < valid_from:
            raise serializers.ValidationError(
                {"valid_to": "La fecha final no puede ser anterior a la fecha inicial."}
            )

        rates = SalaryRate.objects.filter(employee=employee)
        if self.instance:
            rates = rates.exclude(pk=self.instance.pk)
        if valid_to:
            conflicts = rates.filter(valid_from__lte=valid_to).filter(
                Q(valid_to__isnull=True) | Q(valid_to__gte=valid_from)
            )
        else:
            conflicts = rates.filter(Q(valid_to__isnull=True) | Q(valid_to__gte=valid_from))

        closable = None
        if not self.instance and valid_to is None:
            closable = conflicts.filter(valid_to__isnull=True, valid_from__lt=valid_from).first()
        remaining = conflicts.exclude(pk=closable.pk) if closable else conflicts
        if remaining.exists():
            raise serializers.ValidationError(
                "La vigencia se cruza con otra tarifa salarial del empleado."
            )
        self._closable_rate = closable
        return attrs

    @database_transaction.atomic
    def create(self, validated_data):
        closable = getattr(self, "_closable_rate", None)
        if closable:
            closable.valid_to = validated_data["valid_from"] - timedelta(days=1)
            closable.save(update_fields=("valid_to", "updated_at"))
        return super().create(validated_data)


class WorkEntrySerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source="employee.full_name", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = WorkEntry
        fields = (
            "id",
            "employee",
            "employee_name",
            "project",
            "project_name",
            "work_date",
            "status",
            "status_label",
            "day_fraction",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "employee_name",
            "project_name",
            "status_label",
            "day_fraction",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        )

    def get_created_by_name(self, instance):
        return instance.created_by.get_full_name().strip() or instance.created_by.email

    def validate(self, attrs):
        from .services import work_date_is_locked

        request = self.context["request"]
        employee = attrs.get("employee", getattr(self.instance, "employee", None))
        project = attrs.get("project", getattr(self.instance, "project", None))
        work_date = attrs.get("work_date", getattr(self.instance, "work_date", None))

        if work_date_is_locked(work_date):
            raise serializers.ValidationError(
                {"work_date": "La asistencia está bloqueada por una planilla aprobada o pagada."}
            )
        if (
            employee
            and not employee.is_active
            and (not self.instance or employee.pk != self.instance.employee_id)
        ):
            raise serializers.ValidationError({"employee": "El empleado está inactivo."})
        if (
            project
            and project.status != Project.Status.ACTIVE
            and (not self.instance or project.pk != self.instance.project_id)
        ):
            raise serializers.ValidationError({"project": "El proyecto está inactivo."})
        if (
            request.user.role == User.Role.WORKER
            and not project.memberships.filter(user=request.user).exists()
        ):
            raise serializers.ValidationError({"project": "No tienes acceso a este proyecto."})
        return attrs


class BulkWorkEntryItemSerializer(serializers.Serializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.filter(is_active=True))
    project = serializers.PrimaryKeyRelatedField(
        queryset=Project.objects.filter(status=Project.Status.ACTIVE)
    )
    status = serializers.ChoiceField(choices=WorkEntry.Status.choices)


class BulkWorkEntrySerializer(serializers.Serializer):
    work_date = serializers.DateField()
    entries = BulkWorkEntryItemSerializer(many=True, allow_empty=False)

    def validate_entries(self, entries):
        employee_ids = [entry["employee"].pk for entry in entries]
        if len(employee_ids) != len(set(employee_ids)):
            raise serializers.ValidationError("Cada empleado debe aparecer una sola vez.")
        return entries


class PayrollPeriodSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    approved_by_name = serializers.SerializerMethodField()
    summary = serializers.SerializerMethodField()

    class Meta:
        model = PayrollPeriod
        fields = (
            "id",
            "start_date",
            "end_date",
            "status",
            "status_label",
            "category",
            "category_name",
            "approved_by",
            "approved_by_name",
            "approved_at",
            "paid_at",
            "summary",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "status",
            "status_label",
            "category",
            "category_name",
            "approved_by",
            "approved_by_name",
            "approved_at",
            "paid_at",
            "summary",
            "created_at",
            "updated_at",
        )

    def get_approved_by_name(self, instance):
        if not instance.approved_by:
            return ""
        return instance.approved_by.get_full_name().strip() or instance.approved_by.email

    def get_summary(self, instance):
        try:
            return get_payroll_summary(instance)
        except PayrollCalculationError as error:
            return {"employees": [], "projects": [], "grand_total": "0.00", "error": str(error)}

    def validate(self, attrs):
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError(
                {"end_date": "La fecha final no puede ser anterior a la inicial."}
            )
        if self.instance and self.instance.status != PayrollPeriod.Status.DRAFT:
            raise serializers.ValidationError("Una planilla aprobada o pagada está bloqueada.")
        try:
            calculate_payroll_values(SimpleNamespace(start_date=start_date, end_date=end_date))
        except PayrollCalculationError as error:
            raise serializers.ValidationError(str(error)) from error
        return attrs


class PayrollPaymentSerializer(serializers.Serializer):
    category = serializers.PrimaryKeyRelatedField(
        queryset=FinancialCategory.objects.filter(is_active=True)
    )
