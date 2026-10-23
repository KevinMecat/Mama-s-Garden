from django.db import transaction as database_transaction
from django.db.models.deletion import ProtectedError
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from modules.accounts.models import User
from modules.accounts.permissions import IsAdministrator

from .models import Employee, PayrollPeriod, SalaryRate, WorkEntry
from .serializers import (
    BulkWorkEntrySerializer,
    EmployeeSerializer,
    PayrollPaymentSerializer,
    PayrollPeriodSerializer,
    SalaryRateSerializer,
    WorkEntrySerializer,
)
from .services import (
    PayrollCalculationError,
    approve_payroll_period,
    pay_payroll_period,
    work_date_is_locked,
)


class AdministratorWriteViewSet(viewsets.ModelViewSet):
    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [IsAuthenticated(), IsAdministrator()]
        return [IsAuthenticated()]


class EmployeeViewSet(AdministratorWriteViewSet):
    serializer_class = EmployeeSerializer
    queryset = Employee.objects.prefetch_related("salary_rates").all()

    def get_queryset(self):
        queryset = super().get_queryset()
        active_filter = self.request.query_params.get("is_active")
        if active_filter in {"true", "false"}:
            queryset = queryset.filter(is_active=active_filter == "true")
        return queryset

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "El empleado tiene historial operativo; desactívalo."},
                status=status.HTTP_409_CONFLICT,
            )


class SalaryRateViewSet(AdministratorWriteViewSet):
    serializer_class = SalaryRateSerializer
    queryset = SalaryRate.objects.select_related("employee").all()

    def get_queryset(self):
        queryset = super().get_queryset()
        employee_filter = self.request.query_params.get("employee")
        if employee_filter:
            if not employee_filter.isdecimal():
                raise ValidationError({"employee": "El empleado indicado no es válido."})
            queryset = queryset.filter(employee_id=employee_filter)
        return queryset


class WorkEntryViewSet(viewsets.ModelViewSet):
    serializer_class = WorkEntrySerializer
    permission_classes = (IsAuthenticated,)
    queryset = WorkEntry.objects.none()

    def get_queryset(self):
        queryset = WorkEntry.objects.select_related("employee", "project", "created_by")
        if self.request.user.role == User.Role.WORKER:
            queryset = queryset.filter(project__memberships__user=self.request.user)
        work_date = self.request.query_params.get("work_date")
        if work_date:
            queryset = queryset.filter(work_date=work_date)
        return queryset.distinct()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        if work_date_is_locked(instance.work_date):
            raise PermissionDenied("La asistencia pertenece a una planilla bloqueada.")
        instance.delete()

    @action(detail=False, methods=("post",), url_path="bulk")
    @database_transaction.atomic
    def bulk(self, request):
        bulk_serializer = BulkWorkEntrySerializer(data=request.data)
        bulk_serializer.is_valid(raise_exception=True)
        work_date = bulk_serializer.validated_data["work_date"]
        if work_date_is_locked(work_date):
            raise ValidationError(
                {"work_date": "La asistencia está bloqueada por una planilla aprobada o pagada."}
            )

        saved = []
        for item in bulk_serializer.validated_data["entries"]:
            if (
                request.user.role == User.Role.WORKER
                and not item["project"].memberships.filter(user=request.user).exists()
            ):
                raise PermissionDenied("No tienes acceso a uno de los proyectos seleccionados.")
            instance, _ = WorkEntry.objects.update_or_create(
                employee=item["employee"],
                work_date=work_date,
                defaults={
                    "project": item["project"],
                    "status": item["status"],
                    "created_by": request.user,
                },
            )
            saved.append(instance)

        return Response(
            WorkEntrySerializer(saved, many=True, context={"request": request}).data,
            status=status.HTTP_200_OK,
        )


class PayrollPeriodViewSet(viewsets.ModelViewSet):
    serializer_class = PayrollPeriodSerializer
    permission_classes = (IsAuthenticated, IsAdministrator)
    queryset = PayrollPeriod.objects.select_related("category", "approved_by").prefetch_related(
        "lines", "lines__employee", "lines__project", "expenses"
    )

    def perform_destroy(self, instance):
        if instance.status != PayrollPeriod.Status.DRAFT:
            raise PermissionDenied("Una planilla aprobada o pagada no se puede eliminar.")
        instance.delete()

    @action(detail=True, methods=("post",))
    def approve(self, request, *args, **kwargs):
        period = self.get_object()
        try:
            period = approve_payroll_period(period, request.user)
        except PayrollCalculationError as error:
            raise ValidationError({"detail": str(error)}) from error
        return Response(self.get_serializer(period).data)

    @action(detail=True, methods=("post",))
    def pay(self, request, *args, **kwargs):
        period = self.get_object()
        payment_serializer = PayrollPaymentSerializer(data=request.data)
        payment_serializer.is_valid(raise_exception=True)
        try:
            period = pay_payroll_period(
                period,
                request.user,
                payment_serializer.validated_data["category"],
            )
        except PayrollCalculationError as error:
            raise ValidationError({"detail": str(error)}) from error
        return Response(self.get_serializer(period).data)
