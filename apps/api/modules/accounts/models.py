import uuid
from typing import ClassVar

from django.contrib.auth.models import AbstractUser
from django.db import models

from .managers import UserManager


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMINISTRATOR = "ADMIN", "Administrador"
        WORKER = "WORKER", "Trabajador"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )
    username = None
    email = models.EmailField(
        "correo electronico",
        unique=True,
    )
    role = models.CharField(
        "rol",
        max_length=10,
        choices=Role.choices,
        default=Role.WORKER,
        db_index=True,
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: ClassVar[list[str]] = []

    objects = UserManager()

    @property
    def is_administrator(self):
        return self.role == self.Role.ADMINISTRATOR

    def __str__(self):
        return self.email
