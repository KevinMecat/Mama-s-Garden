from django.db.models import Count
from django.db.models.deletion import ProtectedError
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from modules.accounts.models import User
from modules.accounts.permissions import IsAdministrator

from .models import Project
from .serializers import ProjectSerializer


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = (IsAuthenticated,)
    queryset = Project.objects.none()

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [IsAuthenticated(), IsAdministrator()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = Project.objects.annotate(
            member_count=Count("memberships", distinct=True)
        ).order_by("-created_at")

        if self.request.user.role == User.Role.WORKER:
            queryset = queryset.filter(memberships__user=self.request.user)

        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset.distinct()

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "El proyecto tiene movimientos asociados y no se puede eliminar."},
                status=status.HTTP_409_CONFLICT,
            )

    @action(detail=True, methods=("get",), url_path="metrics")
    def metrics(self, request, *args, **kwargs):
        from modules.production.services import calculate_project_metrics

        project = self.get_object()
        return Response(calculate_project_metrics(project))
