from rest_framework.permissions import BasePermission

from .models import User


class IsAdministrator(BasePermission):
    message = "Esta accion requiere permisos de administrador."

    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and request.user.role == User.Role.ADMINISTRATOR)


class CanUseWorkerFeatures(BasePermission):
    """Los administradores heredan todas las capacidades operativas del trabajador."""

    message = "Esta accion requiere un rol operativo valido."

    def has_permission(self, request, view):
        return bool(
            request.user.is_authenticated
            and request.user.role in {User.Role.ADMINISTRATOR, User.Role.WORKER}
        )
