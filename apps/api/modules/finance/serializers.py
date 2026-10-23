from typing import ClassVar

from django.db import transaction as database_transaction
from rest_framework import serializers

from modules.accounts.models import User
from modules.projects.models import Project

from .models import FinancialCategory, Transaction, TransactionAttachment
from .validators import validate_receipt_size


class FinancialCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialCategory
        fields = ("id", "name", "description", "is_active", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class TransactionAttachmentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = TransactionAttachment
        fields = (
            "id",
            "transaction",
            "file",
            "file_url",
            "original_name",
            "content_type",
            "size",
            "uploaded_by",
            "uploaded_by_name",
            "uploaded_at",
        )
        read_only_fields = (
            "id",
            "file_url",
            "original_name",
            "content_type",
            "size",
            "uploaded_by",
            "uploaded_by_name",
            "uploaded_at",
        )
        extra_kwargs: ClassVar[dict] = {"file": {"write_only": True}}

    def get_file_url(self, instance) -> str | None:
        return instance.file.url if instance.file else None

    def get_uploaded_by_name(self, instance) -> str:
        if not instance.uploaded_by:
            return "Usuario eliminado"
        return instance.uploaded_by.get_full_name().strip() or instance.uploaded_by.email

    def validate(self, attrs):
        request = self.context["request"]
        user = request.user
        target_transaction = attrs.get(
            "transaction",
            getattr(self.instance, "transaction", None),
        )

        if user.role == User.Role.WORKER:
            if self.instance and self.instance.uploaded_by_id != user.id:
                raise serializers.ValidationError(
                    "Solo puedes modificar comprobantes que tú hayas subido."
                )
            if (
                not target_transaction
                or target_transaction.created_by_id != user.id
                or target_transaction.status != Transaction.Status.DRAFT
                or not target_transaction.project.memberships.filter(user=user).exists()
            ):
                raise serializers.ValidationError(
                    "Solo puedes adjuntar archivos a tus propios borradores asignados."
                )

        return attrs

    def create(self, validated_data):
        receipt = validated_data["file"]
        return TransactionAttachment.objects.create(
            **validated_data,
            original_name=receipt.name,
            content_type=getattr(receipt, "content_type", ""),
            size=receipt.size,
            uploaded_by=self.context["request"].user,
        )

    def update(self, instance, validated_data):
        receipt = validated_data.get("file")
        if receipt:
            validated_data.update(
                original_name=receipt.name,
                content_type=getattr(receipt, "content_type", ""),
                size=receipt.size,
            )
        return super().update(instance, validated_data)


class TransactionSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="project.name", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    type_label = serializers.CharField(source="get_type_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    created_by_name = serializers.SerializerMethodField()
    attachments = TransactionAttachmentSerializer(many=True, read_only=True)
    receipt = serializers.ImageField(
        write_only=True,
        required=False,
        allow_null=True,
        validators=[validate_receipt_size],
    )

    class Meta:
        model = Transaction
        fields = (
            "id",
            "project",
            "project_name",
            "category",
            "category_name",
            "type",
            "type_label",
            "status",
            "status_label",
            "amount",
            "transaction_date",
            "description",
            "supplier_or_customer",
            "created_by",
            "created_by_name",
            "attachments",
            "receipt",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "project_name",
            "category_name",
            "type_label",
            "status_label",
            "created_by",
            "created_by_name",
            "attachments",
            "created_at",
            "updated_at",
        )

    def get_created_by_name(self, instance) -> str:
        return instance.created_by.get_full_name().strip() or instance.created_by.email

    def validate(self, attrs):
        request = self.context["request"]
        user = request.user
        project = attrs.get("project", getattr(self.instance, "project", None))
        category = attrs.get("category", getattr(self.instance, "category", None))
        desired_status = attrs.get(
            "status",
            getattr(self.instance, "status", Transaction.Status.DRAFT),
        )

        if project and project.status != Project.Status.ACTIVE:
            raise serializers.ValidationError(
                {"project": "Solo se pueden registrar movimientos en proyectos activos."}
            )

        if category and not category.is_active:
            raise serializers.ValidationError(
                {"category": "La categoría seleccionada está inactiva."}
            )

        if user.role == User.Role.WORKER:
            if not project or not project.memberships.filter(user=user).exists():
                raise serializers.ValidationError({"project": "No tienes acceso a este proyecto."})
            if desired_status != Transaction.Status.DRAFT:
                raise serializers.ValidationError(
                    {"status": "Los trabajadores solo pueden guardar borradores."}
                )
            if self.instance and (
                self.instance.created_by_id != user.id
                or self.instance.status != Transaction.Status.DRAFT
            ):
                raise serializers.ValidationError("Solo puedes modificar tus propios borradores.")

        return attrs

    @database_transaction.atomic
    def create(self, validated_data):
        receipt = validated_data.pop("receipt", None)
        transaction_record = Transaction.objects.create(**validated_data)

        if receipt:
            TransactionAttachment.objects.create(
                transaction=transaction_record,
                file=receipt,
                original_name=receipt.name,
                content_type=getattr(receipt, "content_type", ""),
                size=receipt.size,
                uploaded_by=self.context["request"].user,
            )

        return transaction_record

    @database_transaction.atomic
    def update(self, instance, validated_data):
        receipt = validated_data.pop("receipt", None)
        transaction_record = super().update(instance, validated_data)

        if receipt:
            TransactionAttachment.objects.create(
                transaction=transaction_record,
                file=receipt,
                original_name=receipt.name,
                content_type=getattr(receipt, "content_type", ""),
                size=receipt.size,
                uploaded_by=self.context["request"].user,
            )

        return transaction_record
