from django.contrib import admin

from .models import FinancialCategory, Transaction, TransactionAttachment


@admin.register(FinancialCategory)
class FinancialCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("name", "description")


class TransactionAttachmentInline(admin.TabularInline):
    model = TransactionAttachment
    extra = 0
    readonly_fields = ("original_name", "content_type", "size", "uploaded_by", "uploaded_at")


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        "transaction_date",
        "description",
        "project",
        "type",
        "status",
        "amount",
    )
    list_filter = ("type", "status", "project", "category")
    search_fields = ("description", "supplier_or_customer", "project__name")
    autocomplete_fields = ("project", "category", "created_by")
    readonly_fields = ("created_at", "updated_at")
    inlines = (TransactionAttachmentInline,)


@admin.register(TransactionAttachment)
class TransactionAttachmentAdmin(admin.ModelAdmin):
    list_display = ("original_name", "transaction", "size", "uploaded_by", "uploaded_at")
    search_fields = ("original_name", "transaction__description")
    autocomplete_fields = ("transaction", "uploaded_by")
    readonly_fields = ("original_name", "content_type", "size", "uploaded_at")
