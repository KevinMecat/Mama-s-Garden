from decimal import Decimal

from rest_framework import serializers

from modules.payroll.models import Employee
from modules.projects.models import Project

from .models import Task


class PlanSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=160)
    activity = serializers.CharField(max_length=100)
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.all())
    location = serializers.CharField(max_length=160)
    scheduled_date = serializers.DateField()
    priority = serializers.ChoiceField(choices=Task.Priority.choices, default=Task.Priority.NORMAL)
    instructions = serializers.CharField(allow_blank=True, required=False, max_length=5000)
    acceptance_criteria = serializers.CharField(max_length=5000)
    target_quantity = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0.01"), allow_null=True, required=False
    )
    unit = serializers.CharField(max_length=40, allow_blank=True, required=False)
    estimated_minutes = serializers.IntegerField(
        min_value=1, max_value=10080, allow_null=True, required=False
    )
    assignees = serializers.PrimaryKeyRelatedField(
        queryset=Employee.objects.all(), many=True, allow_empty=False
    )

    def validate(self, data):
        if data["project"].status != Project.Status.ACTIVE:
            raise serializers.ValidationError("Selecciona un proyecto activo.")
        if any(not employee.is_active for employee in data["assignees"]):
            raise serializers.ValidationError("No se puede asignar un empleado inactivo.")
        ids = [employee.pk for employee in data["assignees"]]
        if len(ids) != len(set(ids)):
            raise serializers.ValidationError("Responsables duplicados.")
        if bool(data.get("target_quantity") is not None) != bool(data.get("unit")):
            raise serializers.ValidationError("Meta numérica y unidad deben indicarse juntas.")
        return data


class TimeSerializer(serializers.Serializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.objects.all())
    minutes = serializers.IntegerField(min_value=1, max_value=1440)


class CommandSerializer(serializers.Serializer):
    key = serializers.UUIDField()
    revision = serializers.IntegerField(min_value=1)
    action = serializers.ChoiceField(
        choices=(
            "time",
            "start",
            "submit",
            "accept",
            "return",
            "block",
            "unblock",
            "cancel",
            "duplicate",
        )
    )
    result = serializers.CharField(max_length=5000, required=False)
    criterion_met = serializers.BooleanField(required=False)
    quantity = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0"), allow_null=True, required=False
    )
    accepted_quantity = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=Decimal("0"), allow_null=True, required=False
    )
    incidents = serializers.CharField(max_length=5000, allow_blank=True, required=False)
    observations = serializers.CharField(max_length=5000, required=False)
    reason = serializers.CharField(max_length=2000, required=False)
    times = TimeSerializer(many=True, required=False, allow_empty=False)
    scheduled_date = serializers.DateField(required=False)
