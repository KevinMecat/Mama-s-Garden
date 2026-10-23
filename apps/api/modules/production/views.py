from django.db import transaction as database_transaction
from django.db.models.deletion import ProtectedError
from rest_framework import status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from modules.accounts.models import User
from modules.accounts.permissions import IsAdministrator

from .models import Product, ProductionRecord, Sale
from .serializers import ProductionRecordSerializer, ProductSerializer, SaleSerializer


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    queryset = Product.objects.all()

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
                {"detail": "El producto tiene producción o ventas asociadas; desactívalo."},
                status=status.HTTP_409_CONFLICT,
            )


class ProductionRecordViewSet(viewsets.ModelViewSet):
    serializer_class = ProductionRecordSerializer
    permission_classes = (IsAuthenticated,)
    queryset = ProductionRecord.objects.none()

    def get_queryset(self):
        queryset = ProductionRecord.objects.select_related("project", "product", "created_by")
        if self.request.user.role == User.Role.WORKER:
            queryset = queryset.filter(project__memberships__user=self.request.user)
        project_filter = self.request.query_params.get("project")
        if project_filter:
            if not project_filter.isdecimal():
                raise ValidationError({"project": "El proyecto indicado no es válido."})
            queryset = queryset.filter(project_id=project_filter)
        return queryset.distinct()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        if (
            self.request.user.role == User.Role.WORKER
            and instance.created_by_id != self.request.user.id
        ):
            raise PermissionDenied("Solo puedes eliminar tus propios registros.")
        instance.delete()


class SaleViewSet(viewsets.ModelViewSet):
    serializer_class = SaleSerializer
    permission_classes = (IsAuthenticated,)
    queryset = Sale.objects.none()

    def get_queryset(self):
        queryset = Sale.objects.select_related(
            "project",
            "product",
            "transaction",
            "transaction__category",
            "transaction__created_by",
        )
        if self.request.user.role == User.Role.WORKER:
            queryset = queryset.filter(project__memberships__user=self.request.user)
        project_filter = self.request.query_params.get("project")
        if project_filter:
            if not project_filter.isdecimal():
                raise ValidationError({"project": "El proyecto indicado no es válido."})
            queryset = queryset.filter(project_id=project_filter)
        return queryset.distinct()

    @database_transaction.atomic
    def perform_destroy(self, instance):
        user = self.request.user
        transaction_record = instance.transaction
        if user.role == User.Role.WORKER and (
            transaction_record.created_by_id != user.id
            or transaction_record.status != transaction_record.Status.DRAFT
        ):
            raise PermissionDenied("Solo puedes eliminar tus propias ventas en borrador.")
        instance.delete()
        transaction_record.delete()
