from django.db import transaction as database_transaction
from rest_framework import serializers

from modules.accounts.models import User
from modules.finance.models import FinancialCategory, Transaction
from modules.projects.models import Project

from .models import Product, ProductionRecord, Sale


def validate_operational_access(user, project, *, owner_id=None, current_project_id=None):
    if project and project.status != Project.Status.ACTIVE and project.id != current_project_id:
        raise serializers.ValidationError(
            {"project": "Solo se pueden registrar operaciones en proyectos activos."}
        )
    if user.role == User.Role.WORKER:
        if not project or not project.memberships.filter(user=user).exists():
            raise serializers.ValidationError({"project": "No tienes acceso a este proyecto."})
        if owner_id and owner_id != user.id:
            raise serializers.ValidationError("Solo puedes modificar tus propios registros.")


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ("id", "name", "unit_of_measure", "is_active", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class ProductionRecordSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source="project.name", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    unit_of_measure = serializers.CharField(source="product.unit_of_measure", read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ProductionRecord
        fields = (
            "id",
            "project",
            "project_name",
            "product",
            "product_name",
            "unit_of_measure",
            "production_date",
            "quantity",
            "notes",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "project_name",
            "product_name",
            "unit_of_measure",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        )

    def get_created_by_name(self, instance):
        return instance.created_by.get_full_name().strip() or instance.created_by.email

    def validate(self, attrs):
        user = self.context["request"].user
        project = attrs.get("project", getattr(self.instance, "project", None))
        product = attrs.get("product", getattr(self.instance, "product", None))
        owner_id = self.instance.created_by_id if self.instance else None
        current_project_id = self.instance.project_id if self.instance else None
        validate_operational_access(
            user,
            project,
            owner_id=owner_id,
            current_project_id=current_project_id,
        )
        if (
            product
            and not product.is_active
            and (not self.instance or product.id != self.instance.product_id)
        ):
            raise serializers.ValidationError(
                {"product": "El producto seleccionado está inactivo."}
            )
        return attrs


class SaleSerializer(serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(
        queryset=FinancialCategory.objects.all(),
        write_only=True,
        required=False,
    )
    category_id = serializers.IntegerField(source="transaction.category_id", read_only=True)
    category_name = serializers.CharField(source="transaction.category.name", read_only=True)
    status = serializers.ChoiceField(choices=Transaction.Status.choices, required=False)
    status_label = serializers.CharField(source="transaction.get_status_display", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    unit_of_measure = serializers.CharField(source="product.unit_of_measure", read_only=True)
    created_by = serializers.UUIDField(source="transaction.created_by_id", read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Sale
        fields = (
            "id",
            "project",
            "project_name",
            "product",
            "product_name",
            "unit_of_measure",
            "sale_date",
            "quantity",
            "unit_price",
            "total_amount",
            "customer",
            "category",
            "category_id",
            "category_name",
            "status",
            "status_label",
            "transaction",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "project_name",
            "product_name",
            "unit_of_measure",
            "total_amount",
            "category_id",
            "category_name",
            "status_label",
            "transaction",
            "created_by",
            "created_by_name",
            "created_at",
            "updated_at",
        )

    def get_created_by_name(self, instance):
        user = instance.transaction.created_by
        return user.get_full_name().strip() or user.email

    def validate(self, attrs):
        user = self.context["request"].user
        project = attrs.get("project", getattr(self.instance, "project", None))
        product = attrs.get("product", getattr(self.instance, "product", None))
        category = attrs.get("category")
        if self.instance and category is None:
            category = self.instance.transaction.category
        desired_status = attrs.get("status")
        if self.instance and desired_status is None:
            desired_status = self.instance.transaction.status
        desired_status = desired_status or Transaction.Status.DRAFT

        owner_id = self.instance.transaction.created_by_id if self.instance else None
        current_project_id = self.instance.project_id if self.instance else None
        validate_operational_access(
            user,
            project,
            owner_id=owner_id,
            current_project_id=current_project_id,
        )

        if (
            product
            and not product.is_active
            and (not self.instance or product.id != self.instance.product_id)
        ):
            raise serializers.ValidationError(
                {"product": "El producto seleccionado está inactivo."}
            )
        if category is None:
            raise serializers.ValidationError({"category": "Selecciona una categoría financiera."})
        if not category.is_active and (
            not self.instance or category.id != self.instance.transaction.category_id
        ):
            raise serializers.ValidationError(
                {"category": "La categoría seleccionada está inactiva."}
            )
        if user.role == User.Role.WORKER:
            if desired_status != Transaction.Status.DRAFT:
                raise serializers.ValidationError(
                    {"status": "Los trabajadores solo pueden guardar ventas en borrador."}
                )
            if self.instance and self.instance.transaction.status != Transaction.Status.DRAFT:
                raise serializers.ValidationError(
                    "Solo puedes modificar tus propias ventas en borrador."
                )
        return attrs

    @database_transaction.atomic
    def create(self, validated_data):
        category = validated_data.pop("category")
        desired_status = validated_data.pop("status", Transaction.Status.DRAFT)
        total = Sale.calculate_total(validated_data["quantity"], validated_data["unit_price"])
        transaction_record = Transaction.objects.create(
            project=validated_data["project"],
            category=category,
            type=Transaction.Type.INCOME,
            status=desired_status,
            amount=total,
            transaction_date=validated_data["sale_date"],
            description=f"Venta de {validated_data['product'].name}",
            supplier_or_customer=validated_data.get("customer", ""),
            created_by=self.context["request"].user,
        )
        return Sale.objects.create(transaction=transaction_record, **validated_data)

    @database_transaction.atomic
    def update(self, instance, validated_data):
        category = validated_data.pop("category", instance.transaction.category)
        desired_status = validated_data.pop("status", instance.transaction.status)
        sale = super().update(instance, validated_data)
        transaction_record = sale.transaction
        transaction_record.project = sale.project
        transaction_record.category = category
        transaction_record.type = Transaction.Type.INCOME
        transaction_record.status = desired_status
        transaction_record.amount = sale.total_amount
        transaction_record.transaction_date = sale.sale_date
        transaction_record.description = f"Venta de {sale.product.name}"
        transaction_record.supplier_or_customer = sale.customer
        transaction_record.save()
        return sale
