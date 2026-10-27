from decimal import Decimal

from django.conf import settings
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

from modules.accounts.models import User
from modules.payroll.models import WorkEntry
from modules.projects.models import ProjectMember

from .models import EmployeeAccount, Review, Task, TaskEvent, TimeEntry, WorkLog


class Conflict(APIException):
    status_code = 409
    default_detail = "La tarea cambió. Recarga antes de intentarlo de nuevo."


def administrator(user):
    return user.role == User.Role.ADMINISTRATOR


def require_admin(user):
    if not administrator(user):
        raise PermissionDenied("Solo el administrador puede planificar y revisar.")


def visible_tasks(user):
    tasks = Task.objects.all()
    if not administrator(user):
        tasks = tasks.filter(
            assignees__employeeaccount__user=user,
            project__memberships__user=user,
        )
    return tasks.distinct()


def event(task, user, action, detail=None):
    TaskEvent.objects.create(task=task, actor=user, action=action, detail=detail or {})


def check_assignments(plan):
    for employee in plan["assignees"]:
        link = EmployeeAccount.objects.filter(employee=employee).first()
        if (
            link
            and not ProjectMember.objects.filter(project=plan["project"], user=link.user).exists()
        ):
            raise ValidationError("Un responsable vinculado no pertenece al proyecto.")


def save_plan(task, data, user):
    require_admin(user)
    check_assignments(data)
    if task and (task.cancelled_at or task.state not in (Task.State.TODO, Task.State.IN_PROGRESS)):
        raise Conflict("Solo se puede editar la planificación antes de la revisión.")
    if task and task.work_logs.exists():
        # Do not change unit, attribution or criteria underneath recorded results.
        raise Conflict("La planificación con resultados es inmutable; duplica la tarea.")
    assignees = data.pop("assignees")
    if task:
        for name, value in data.items():
            setattr(task, name, value)
        task.revision += 1
        task.save()
    else:
        task = Task.objects.create(created_by=user, **data)
    task.assignees.set(assignees)
    event(
        task,
        user,
        "plan",
        {
            "revision": task.revision,
            "plan": {
                **{k: str(v.pk if hasattr(v, "pk") else v) for k, v in data.items()},
                "assignees": [person.pk for person in assignees],
            },
        },
    )
    return task


def command(task, data, user):
    action = data["action"]
    if task.revision != data["revision"]:
        raise Conflict()
    manager_actions = {"accept", "return", "cancel", "duplicate"}
    if action in manager_actions:
        require_admin(user)
    if action == "duplicate":
        fields = (
            "title",
            "activity",
            "project",
            "location",
            "priority",
            "instructions",
            "acceptance_criteria",
            "target_quantity",
            "unit",
            "estimated_minutes",
        )
        plan = {name: getattr(task, name) for name in fields}
        plan["scheduled_date"] = data.get("scheduled_date", timezone.localdate())
        plan["assignees"] = list(task.assignees.all())
        if any(not person.is_active for person in plan["assignees"]):
            raise ValidationError("Actualiza los responsables inactivos antes de duplicar.")
        if task.project.status != "active":
            raise ValidationError("El proyecto ya no está activo.")
        copied = save_plan(None, plan, user)
        event(copied, user, "duplicate", {"source": task.pk})
        return copied
    if task.cancelled_at:
        raise Conflict("La tarea está cancelada; su historial se conserva.")
    if action == "cancel":
        if task.state == Task.State.DONE:
            raise Conflict("Un resultado aceptado no puede cancelarse.")
        if not data.get("reason"):
            raise ValidationError("Indica el motivo de cancelación.")
        task.cancelled_at = timezone.now()
        task.cancelled_reason = data["reason"]
    elif action in {"block", "unblock"}:
        if task.state == Task.State.DONE:
            raise Conflict("El trabajo ya fue aceptado.")
        if action == "block" and not data.get("reason"):
            raise ValidationError("Indica el motivo del bloqueo.")
        if action == "unblock" and not task.blocked_reason:
            raise Conflict("La tarea no está bloqueada.")
        task.blocked_reason = data.get("reason", "") if action == "block" else ""
    else:
        if task.blocked_reason:
            raise Conflict("Resuelve el bloqueo antes de cambiar de estado.")
        if action == "start":
            if task.state != Task.State.TODO:
                raise Conflict("Solo puede iniciarse una tarea por hacer.")
            task.state = Task.State.IN_PROGRESS
        elif action == "submit":
            if task.state != Task.State.IN_PROGRESS:
                raise Conflict("Solo se puede registrar trabajo en curso.")
            record_result(task, data, user)
            task.state = Task.State.REVIEW
        elif action == "time":
            if task.state != Task.State.REVIEW:
                raise Conflict("Los tiempos adicionales requieren una revisión pendiente.")
            log = task.work_logs.order_by("-id").first()
            entries = data.get("times", [])
            if not entries:
                raise ValidationError("Indica tiempo dedicado.")
            link = EmployeeAccount.objects.filter(user=user).first()
            for entry in entries:
                person = entry["employee"]
                if not task.assignees.filter(pk=person.pk).exists():
                    raise ValidationError("El empleado no está asignado.")
                if not administrator(user) and (not link or link.employee_id != person.pk):
                    raise PermissionDenied("Solo puedes registrar tu tiempo.")
                if log.times.filter(employee=person).exists():
                    raise Conflict("El tiempo ya está registrado; no se sobrescribe.")
                TimeEntry.objects.create(work_log=log, **entry)
        elif action in {"accept", "return"}:
            if task.state != Task.State.REVIEW:
                raise Conflict("La tarea no está pendiente de revisión.")
            review_result(task, data, user, accepted=action == "accept")
            task.state = Task.State.DONE if action == "accept" else Task.State.IN_PROGRESS
    task.revision += 1
    task.save()
    event(
        task,
        user,
        action,
        {
            "state": task.state,
            "revision": task.revision,
            "reason": data.get("reason", ""),
            "observations": data.get("observations", ""),
        },
    )
    return task


def record_result(task, data, user):
    if not data.get("result") or "criterion_met" not in data or not data.get("times"):
        raise ValidationError("Indica resultado, cumplimiento y tiempos dedicados.")
    if task.target_quantity is not None and data.get("quantity") is None:
        raise ValidationError("Indica cantidad realizada, incluso si es cero.")
    if task.target_quantity is None and data.get("quantity") is not None:
        raise ValidationError("Esta labor se evalúa por cumplimiento, no por cantidad.")
    assignees = set(task.assignees.values_list("pk", flat=True))
    seen = set()
    link = EmployeeAccount.objects.filter(user=user).first()
    for item in data["times"]:
        person = item["employee"].pk
        if person not in assignees or person in seen:
            raise ValidationError("Los tiempos requieren responsables distintos de esta tarea.")
        if not administrator(user) and (not link or link.employee_id != person):
            raise PermissionDenied("Solo puedes registrar tu propio tiempo.")
        seen.add(person)
    if administrator(user) and seen != assignees:
        raise ValidationError("Indica el tiempo real de cada integrante, sin duplicar cantidades.")
    log = WorkLog.objects.create(
        task=task,
        result=data["result"],
        criterion_met=data["criterion_met"],
        quantity=data.get("quantity"),
        incidents=data.get("incidents", ""),
        created_by=user,
    )
    TimeEntry.objects.bulk_create(
        [
            TimeEntry(work_log=log, employee=item["employee"], minutes=item["minutes"])
            for item in data["times"]
        ]
    )


def review_result(task, data, user, accepted):
    if not data.get("observations"):
        raise ValidationError("Registra las observaciones de la revisión.")
    log = task.work_logs.order_by("-id").first()
    if not log or hasattr(log, "review"):
        raise Conflict("No existe un resultado pendiente de revisión.")
    quantity = data.get("accepted_quantity")
    if accepted:
        if set(log.times.values_list("employee_id", flat=True)) != set(
            task.assignees.values_list("pk", flat=True)
        ):
            raise ValidationError("Falta registrar tiempo real de integrantes de la cuadrilla.")
        if not log.criterion_met:
            raise ValidationError("El criterio debe cumplirse antes de aceptar.")
        if task.target_quantity is not None:
            if quantity is None or quantity > log.quantity:
                raise ValidationError("Cantidad aceptada requerida y no superior a la realizada.")
        elif quantity is not None:
            raise ValidationError("Esta labor no tiene cantidad numérica.")
    elif quantity is not None:
        raise ValidationError("Una devolución no registra cantidad aceptada.")
    Review.objects.create(
        work_log=log,
        accepted=accepted,
        accepted_quantity=quantity,
        observations=data["observations"],
        reviewed_by=user,
    )


def warnings_for(task):
    warnings = []
    for employee in task.assignees.all():
        attendance = WorkEntry.objects.filter(
            employee=employee, work_date=task.scheduled_date
        ).first()
        prefix = employee.full_name
        if not employee.is_active:
            warnings.append(f"{prefix}: empleado inactivo.")
        if not attendance:
            warnings.append(f"{prefix}: asistencia no registrada.")
        elif attendance.status == WorkEntry.Status.ABSENT:
            warnings.append(f"{prefix}: figura ausente.")
        elif attendance.project_id != task.project_id:
            warnings.append(f"{prefix}: asistencia registrada en otro proyecto.")
        if not EmployeeAccount.objects.filter(employee=employee).exists():
            warnings.append(f"{prefix}: sin cuenta vinculada; registro a cargo del administrador.")
        capacity = Decimal(settings.WORKFORCE_DAY_MINUTES)
        if attendance:
            capacity *= attendance.day_fraction
        planned = Task.objects.filter(
            assignees=employee, scheduled_date=task.scheduled_date, cancelled_at__isnull=True
        ).exclude(state=Task.State.DONE)
        minutes = planned.aggregate(value=Sum("estimated_minutes"))["value"] or 0
        actual = (
            TimeEntry.objects.filter(
                employee=employee, work_log__task__scheduled_date=task.scheduled_date
            ).aggregate(value=Sum("minutes"))["value"]
            or 0
        )
        if minutes > capacity or actual > capacity:
            warnings.append(
                f"{prefix}: tiempo superior a la jornada de referencia ({capacity} min)."
            )
    return warnings


def task_data(task, user):
    people = list(task.assignees.all())
    logs = []
    accepted_quantity = None
    total_minutes = 0
    for log in task.work_logs.all():
        times = list(log.times.all())
        total_minutes += sum(item.minutes for item in times)
        review = getattr(log, "review", None)
        if review and review.accepted:
            accepted_quantity = review.accepted_quantity
        logs.append(
            {
                "id": log.pk,
                "result": log.result,
                "criterion_met": log.criterion_met,
                "quantity": str(log.quantity) if log.quantity is not None else None,
                "incidents": log.incidents,
                "created_at": log.created_at,
                "times": [
                    {"employee": item.employee_id, "minutes": item.minutes} for item in times
                ],
                "review": {
                    "accepted": review.accepted,
                    "accepted_quantity": (
                        str(review.accepted_quantity)
                        if review.accepted_quantity is not None
                        else None
                    ),
                    "observations": review.observations,
                    "reviewed_by": str(review.reviewed_by_id),
                    "reviewed_by_name": review.reviewed_by.get_full_name()
                    or review.reviewed_by.email,
                    "created_at": review.created_at,
                }
                if review
                else None,
            }
        )
    hours = Decimal(total_minutes) / 60
    productivity = (
        accepted_quantity / hours
        if len(people) == 1 and accepted_quantity is not None and hours > 0
        else None
    )
    fields = (
        "id",
        "title",
        "activity",
        "location",
        "scheduled_date",
        "priority",
        "instructions",
        "acceptance_criteria",
        "target_quantity",
        "unit",
        "estimated_minutes",
        "state",
        "blocked_reason",
        "cancelled_reason",
        "cancelled_at",
        "revision",
        "created_at",
    )
    return {
        **{name: getattr(task, name) for name in fields},
        "target_quantity": str(task.target_quantity) if task.target_quantity is not None else None,
        "created_by": str(task.created_by_id),
        "updated_at": task.updated_at,
        "project": task.project_id,
        "project_name": task.project.name,
        "assignees": [{"id": person.pk, "name": person.full_name} for person in people],
        "work_logs": logs,
        "warnings": warnings_for(task),
        "accepted_quantity": str(accepted_quantity) if accepted_quantity is not None else None,
        "hours": str(round(hours, 2)),
        "productivity": str(round(productivity, 2)) if productivity is not None else None,
        "crew": len(people) > 1,
        "events": [
            {
                "action": item.action,
                "actor": str(item.actor_id),
                "actor_name": item.actor.get_full_name() or item.actor.email,
                "detail": item.detail,
                "created_at": item.created_at,
            }
            for item in task.events.all()
        ],
    }
