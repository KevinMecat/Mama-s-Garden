from django.contrib import admin

from .models import Product, ProductionRecord, Sale


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("name", "unit_of_measure", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("name", "unit_of_measure")


@admin.register(ProductionRecord)
class ProductionRecordAdmin(admin.ModelAdmin):
    list_display = ("product", "project", "production_date", "quantity", "created_by")
    list_filter = ("production_date", "product")
    search_fields = ("project__name", "product__name", "notes")
    autocomplete_fields = ("project", "product", "created_by")


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ("product", "project", "sale_date", "quantity", "total_amount")
    list_filter = ("sale_date", "product")
    search_fields = ("project__name", "product__name", "customer")
    autocomplete_fields = ("project", "product", "transaction")
    readonly_fields = ("total_amount",)
