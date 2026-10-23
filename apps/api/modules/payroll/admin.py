from django.contrib import admin

from .models import Employee, PayrollExpense, PayrollLine, PayrollPeriod, SalaryRate, WorkEntry


class SalaryRateInline(admin.TabularInline):
    model = SalaryRate
    extra = 0


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ("full_name", "phone", "hire_date", "is_active")
    list_filter = ("is_active", "hire_date")
    search_fields = ("first_name", "last_name", "phone")
    inlines = (SalaryRateInline,)


@admin.register(WorkEntry)
class WorkEntryAdmin(admin.ModelAdmin):
    list_display = ("employee", "work_date", "status", "day_fraction", "project")
    list_filter = ("status", "work_date", "project")
    autocomplete_fields = ("employee", "project", "created_by")


class PayrollLineInline(admin.TabularInline):
    model = PayrollLine
    extra = 0
    readonly_fields = ("employee", "project", "worked_days", "gross_amount")
    can_delete = False


class PayrollExpenseInline(admin.TabularInline):
    model = PayrollExpense
    extra = 0
    readonly_fields = ("project", "transaction", "amount")
    can_delete = False


@admin.register(PayrollPeriod)
class PayrollPeriodAdmin(admin.ModelAdmin):
    list_display = ("start_date", "end_date", "status", "category", "paid_at")
    list_filter = ("status",)
    readonly_fields = ("status", "category", "approved_by", "approved_at", "paid_at")
    inlines = (PayrollLineInline, PayrollExpenseInline)


admin.site.register(SalaryRate)
