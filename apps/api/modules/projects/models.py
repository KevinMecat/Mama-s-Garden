import uuid
from typing import ClassVar

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class Project(models.Model):
    class Type(models.TextChoices):
        POULTRY_PRODUCTION = "produccion_avicola", "Producción avícola"
        CITRUS_CULTIVATION = "cultivo_citricos", "Cultivo de cítricos"
        INFRASTRUCTURE = "infraestructura", "Infraestructura"
        ADMINISTRATION = "administracion", "Administración"

    class Status(models.TextChoices):
        DRAFT = "draft", "Borrador"
        ACTIVE = "active", "Activo"
        COMPLETED = "completed", "Finalizado"

    code = models.UUIDField(
        "código",
        default=uuid.uuid4,
        unique=True,
        editable=False,
    )
    name = models.CharField("nombre", max_length=160)
    description = models.TextField("descripción", blank=True)
    type = models.CharField("tipo", max_length=32, choices=Type.choices)
    status = models.CharField(
        "estado",
        max_length=16,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    start_date = models.DateField("fecha de inicio", blank=True, null=True)
    end_date = models.DateField("fecha de finalización", blank=True, null=True)
    is_system = models.BooleanField("proyecto del sistema", default=False, editable=False)
    created_at = models.DateTimeField("creado", auto_now_add=True)
    updated_at = models.DateTimeField("actualizado", auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "proyecto"
        verbose_name_plural = "proyectos"
        constraints: ClassVar[list] = [
            models.CheckConstraint(
                condition=models.Q(end_date__isnull=True)
                | models.Q(start_date__isnull=True)
                | models.Q(end_date__gte=models.F("start_date")),
                name="project_end_date_on_or_after_start_date",
            )
        ]

    def clean(self):
        super().clean()
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValidationError(
                {"end_date": "La fecha de finalización no puede ser anterior al inicio."}
            )

    def __str__(self):
        return self.name


class ProjectMember(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="memberships",
        verbose_name="proyecto",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="project_memberships",
        verbose_name="usuario",
    )
    created_at = models.DateTimeField("asignado", auto_now_add=True)

    class Meta:
        ordering = ("project__name", "user__email")
        verbose_name = "miembro de proyecto"
        verbose_name_plural = "miembros de proyecto"
        constraints: ClassVar[list] = [
            models.UniqueConstraint(
                fields=("project", "user"),
                name="unique_project_member",
            )
        ]

    def __str__(self):
        return f"{self.user.email} · {self.project.name}"
