import uuid
from typing import ClassVar

from django.conf import settings
from django.db import models


class EmployeeAccount(models.Model):
    employee = models.OneToOneField("payroll.Employee", on_delete=models.PROTECT)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)


class Task(models.Model):
    class State(models.TextChoices):
        TODO = "TODO", "Por hacer"
        IN_PROGRESS = "IN_PROGRESS", "En curso"
        REVIEW = "REVIEW", "Por revisar"
        DONE = "DONE", "Finalizado"

    class Priority(models.TextChoices):
        LOW = "LOW", "Baja"
        NORMAL = "NORMAL", "Normal"
        HIGH = "HIGH", "Alta"

    title = models.CharField(max_length=160)
    activity = models.CharField(max_length=100)
    project = models.ForeignKey("projects.Project", on_delete=models.PROTECT)
    location = models.CharField(max_length=160)
    scheduled_date = models.DateField(db_index=True)
    priority = models.CharField(max_length=8, choices=Priority.choices, default=Priority.NORMAL)
    instructions = models.TextField(blank=True)
    acceptance_criteria = models.TextField()
    target_quantity = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    unit = models.CharField(max_length=40, blank=True)
    estimated_minutes = models.PositiveIntegerField(null=True, blank=True)
    assignees = models.ManyToManyField("payroll.Employee", through="Assignment")
    state = models.CharField(
        max_length=16, choices=State.choices, default=State.TODO, db_index=True
    )
    blocked_reason = models.TextField(blank=True)
    cancelled_reason = models.TextField(blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    revision = models.PositiveIntegerField(default=1)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("scheduled_date", "id")
        constraints: ClassVar[list] = [
            models.CheckConstraint(
                condition=models.Q(target_quantity__isnull=True) | models.Q(target_quantity__gt=0),
                name="workforce_positive_target",
            ),
            models.CheckConstraint(
                condition=models.Q(estimated_minutes__isnull=True)
                | models.Q(estimated_minutes__gt=0),
                name="workforce_positive_estimate",
            ),
        ]


class Assignment(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE)
    employee = models.ForeignKey("payroll.Employee", on_delete=models.PROTECT)

    class Meta:
        constraints: ClassVar[list] = [
            models.UniqueConstraint(fields=("task", "employee"), name="workforce_unique_assignee")
        ]


class WorkLog(models.Model):
    work_date = models.DateField(null=True, blank=True, db_index=True)
    task = models.ForeignKey(Task, on_delete=models.PROTECT, related_name="work_logs")
    result = models.TextField()
    criterion_met = models.BooleanField()
    quantity = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    incidents = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("id",)
        constraints: ClassVar[list] = [
            models.CheckConstraint(
                condition=models.Q(quantity__isnull=True) | models.Q(quantity__gte=0),
                name="workforce_nonnegative_result",
            )
        ]


class TimeEntry(models.Model):
    work_log = models.ForeignKey(WorkLog, on_delete=models.PROTECT, related_name="times")
    employee = models.ForeignKey("payroll.Employee", on_delete=models.PROTECT)
    minutes = models.PositiveIntegerField()

    class Meta:
        constraints: ClassVar[list] = [
            models.UniqueConstraint(
                fields=("work_log", "employee"), name="workforce_unique_logged_time"
            ),
            models.CheckConstraint(
                condition=models.Q(minutes__gt=0), name="workforce_positive_time"
            ),
        ]


class Review(models.Model):
    work_log = models.OneToOneField(WorkLog, on_delete=models.PROTECT, related_name="review")
    accepted = models.BooleanField()
    accepted_quantity = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    observations = models.TextField()
    reviewed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list] = [
            models.CheckConstraint(
                condition=models.Q(accepted_quantity__isnull=True)
                | models.Q(accepted_quantity__gte=0),
                name="workforce_nonnegative_accepted",
            )
        ]


class TaskEvent(models.Model):
    task = models.ForeignKey(Task, on_delete=models.PROTECT, related_name="events")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    action = models.CharField(max_length=24)
    detail = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("id",)


class Operation(models.Model):
    key = models.UUIDField(default=uuid.uuid4)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    task = models.ForeignKey(Task, on_delete=models.PROTECT)
    fingerprint = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints: ClassVar[list] = [
            models.UniqueConstraint(fields=("actor", "key"), name="workforce_idempotent_operation")
        ]
