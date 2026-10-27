from django.db.models.deletion import ProtectedError
from django.http import FileResponse, Http404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from modules.accounts.models import User
from modules.accounts.permissions import IsAdministrator

from .models import FinancialCategory, Transaction, TransactionAttachment
from .serializers import (
    FinancialCategorySerializer,
    TransactionAttachmentSerializer,
    TransactionSerializer,
)


class FinancialCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = FinancialCategorySerializer
    queryset = FinancialCategory.objects.all()

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [IsAuthenticated(), IsAdministrator()]
        return [IsAuthenticated()]

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
                {"detail": "La categoría tiene transacciones y no se puede eliminar."},
                status=status.HTTP_409_CONFLICT,
            )


class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    permission_classes = (IsAuthenticated,)
    parser_classes = (JSONParser, MultiPartParser, FormParser)
    queryset = Transaction.objects.none()

    def get_queryset(self):
        queryset = Transaction.objects.select_related(
            "project",
            "category",
            "created_by",
        ).prefetch_related("attachments", "attachments__uploaded_by")

        if self.request.user.role == User.Role.WORKER:
            queryset = queryset.filter(project__memberships__user=self.request.user)

        project_filter = self.request.query_params.get("project")
        status_filter = self.request.query_params.get("status")
        type_filter = self.request.query_params.get("type")

        if project_filter:
            if not project_filter.isdecimal():
                raise ValidationError({"project": "El proyecto indicado no es válido."})
            queryset = queryset.filter(project_id=project_filter)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if type_filter:
            queryset = queryset.filter(type=type_filter)

        return queryset.distinct()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        user = self.request.user
        if user.role == User.Role.WORKER and (
            instance.created_by_id != user.id or instance.status != Transaction.Status.DRAFT
        ):
            raise PermissionDenied("Solo puedes eliminar tus propios borradores.")
        instance.delete()


class TransactionAttachmentViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionAttachmentSerializer
    permission_classes = (IsAuthenticated,)
    parser_classes = (MultiPartParser, FormParser)
    queryset = TransactionAttachment.objects.none()

    @action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        attachment = self.get_object()
        try:
            handle = attachment.file.open("rb")
        except FileNotFoundError:
            raise Http404 from None
        response = FileResponse(handle, as_attachment=True, filename=attachment.original_name)
        response["Cache-Control"] = "private, no-store"
        return response

    def get_queryset(self):
        queryset = TransactionAttachment.objects.select_related(
            "transaction",
            "transaction__project",
            "transaction__created_by",
            "uploaded_by",
        )
        if self.request.user.role == User.Role.WORKER:
            queryset = queryset.filter(transaction__project__memberships__user=self.request.user)
        return queryset.distinct()

    def perform_destroy(self, instance):
        user = self.request.user
        if user.role == User.Role.WORKER and (
            instance.uploaded_by_id != user.id
            or instance.transaction.created_by_id != user.id
            or instance.transaction.status != Transaction.Status.DRAFT
        ):
            raise PermissionDenied("Solo puedes eliminar comprobantes de tus propios borradores.")
        instance.delete()
