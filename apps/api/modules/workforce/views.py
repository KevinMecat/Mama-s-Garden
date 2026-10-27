import hashlib
import json
import uuid

from django.conf import settings
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from modules.accounts.models import User
from modules.payroll.models import Employee
from modules.projects.models import Project

from .models import EmployeeAccount, Operation, Task
from .serializers import CommandSerializer, PlanSerializer
from .services import (
    Conflict,
    administrator,
    command,
    require_admin,
    save_plan,
    task_data,
    visible_tasks,
)


class Pages(PageNumberPagination):
    page_size = 50


class TaskViewSet(viewsets.GenericViewSet):
    permission_classes = (IsAuthenticated,)
    serializer_class = PlanSerializer
    pagination_class = Pages

    def get_queryset(self):
        return (
            visible_tasks(self.request.user)
            .select_related("project")
            .prefetch_related("assignees", "work_logs__times", "work_logs__review", "events")
            .order_by("scheduled_date", "id")
        )

    def list(self, request):
        tasks = self.get_queryset()
        date_field = serializers.DateField()
        for query, field in (
            ("date", "scheduled_date"),
            ("from", "scheduled_date__gte"),
            ("to", "scheduled_date__lte"),
        ):
            if request.query_params.get(query):
                tasks = tasks.filter(
                    **{field: date_field.run_validation(request.query_params[query])}
                )
        for query, field in (("employee", "assignees__id"), ("project", "project_id")):
            if request.query_params.get(query):
                value = serializers.IntegerField(min_value=1).run_validation(
                    request.query_params[query]
                )
                if query == "employee" and not administrator(request.user):
                    get_object_or_404(EmployeeAccount, user=request.user, employee_id=value)
                tasks = tasks.filter(**{field: value})
        page = self.paginate_queryset(tasks.distinct())
        return self.get_paginated_response([task_data(item, request.user) for item in page])

    def retrieve(self, request, pk=None):
        return Response(task_data(self.get_object(), request.user))

    def _operate(self, request, operation, pk=None):
        try:
            key = uuid.UUID(str(request.data.get("key", "")))
        except ValueError as error:
            raise serializers.ValidationError("Se requiere una clave UUID de operación.") from error
        fingerprint = hashlib.sha256(
            json.dumps(
                {"operation": operation, "task": pk, "body": request.data},
                sort_keys=True,
                separators=(",", ":"),
            ).encode()
        ).hexdigest()

        def replay(saved):
            if saved.fingerprint != fingerprint:
                raise Conflict("La clave de reintento corresponde a otra solicitud.")
            task = get_object_or_404(visible_tasks(request.user), pk=saved.task_id)
            return Response(task_data(task, request.user))

        try:
            with transaction.atomic():
                saved = Operation.objects.filter(actor=request.user, key=key).first()
                if saved:
                    return replay(saved)
                task = None
                if pk:
                    # Lock by PK after access filtering; no lock over nullable joins/distinct.
                    get_object_or_404(visible_tasks(request.user), pk=pk)
                    task = Task.objects.select_for_update().get(pk=pk)
                    saved = Operation.objects.filter(actor=request.user, key=key).first()
                    if saved:
                        return replay(saved)
                if operation in {"create", "edit"}:
                    require_admin(request.user)
                    if task and request.data.get("revision") != task.revision:
                        raise Conflict()
                    plan = PlanSerializer(data=request.data)
                    plan.is_valid(raise_exception=True)
                    task = save_plan(task, dict(plan.validated_data), request.user)
                else:
                    payload = CommandSerializer(data=request.data)
                    payload.is_valid(raise_exception=True)
                    task = command(task, payload.validated_data, request.user)
                Operation.objects.create(
                    actor=request.user, key=key, task=task, fingerprint=fingerprint
                )
                return Response(
                    task_data(task, request.user), status=201 if operation == "create" else 200
                )
        except IntegrityError as error:
            # A simultaneous retry wins once; the losing transaction was rolled back.
            saved = Operation.objects.filter(actor=request.user, key=key).first()
            if saved:
                return replay(saved)
            raise Conflict("Conflicto de datos; recarga antes de reintentar.") from error

    def create(self, request):
        return self._operate(request, "create")

    def partial_update(self, request, pk=None):
        return self._operate(request, "edit", pk)

    @action(detail=True, methods=("post",), url_path="command")
    def apply_command(self, request, pk=None):
        return self._operate(request, "command", pk)

    @action(detail=False, methods=("get",))
    def options_data(self, request):
        manager = administrator(request.user)
        projects = Project.objects.all()
        employees = Employee.objects.all()
        if not manager:
            projects = projects.filter(memberships__user=request.user)
            employees = employees.filter(employeeaccount__user=request.user)
        response = {
            "administrator": manager,
            "day_minutes": settings.WORKFORCE_DAY_MINUTES,
            "projects": list(projects.values("id", "name", "status")),
            "employees": [
                {"id": item.pk, "name": item.full_name, "active": item.is_active}
                for item in employees
            ],
        }
        if manager:
            response["accounts"] = [
                {"id": str(user.pk), "name": user.get_full_name() or user.email}
                for user in User.objects.filter(role=User.Role.WORKER, is_active=True)
            ]
            response["links"] = list(EmployeeAccount.objects.values("employee_id", "user_id"))
        return Response(response)

    @action(detail=False, methods=("post",))
    def link_account(self, request):
        require_admin(request.user)
        employee_id = serializers.IntegerField(min_value=1).run_validation(
            request.data.get("employee")
        )
        user_id = serializers.UUIDField().run_validation(request.data.get("user"))
        employee = get_object_or_404(Employee, pk=employee_id, is_active=True)
        user = get_object_or_404(User, pk=user_id, role=User.Role.WORKER, is_active=True)
        project_ids = Task.objects.filter(assignees=employee).values_list("project_id", flat=True)
        if Project.objects.filter(pk__in=project_ids).exclude(memberships__user=user).exists():
            raise serializers.ValidationError(
                "Asigna la cuenta a sus proyectos antes de vincularla."
            )
        try:
            link, _ = EmployeeAccount.objects.get_or_create(employee=employee, user=user)
        except IntegrityError as error:
            raise Conflict(
                "El empleado o la cuenta ya tienen un vínculo; no se reasigna historial."
            ) from error
        return Response({"employee": link.employee_id, "user": str(link.user_id)})
