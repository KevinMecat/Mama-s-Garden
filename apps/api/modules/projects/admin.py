from django.contrib import admin

from .models import Project, ProjectMember


class ProjectMemberInline(admin.TabularInline):
    model = ProjectMember
    extra = 0
    autocomplete_fields = ("user",)


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "type", "status", "start_date", "end_date")
    list_filter = ("type", "status")
    search_fields = ("name", "description", "code")
    readonly_fields = ("code", "created_at", "updated_at")
    inlines = (ProjectMemberInline,)


@admin.register(ProjectMember)
class ProjectMemberAdmin(admin.ModelAdmin):
    list_display = ("project", "user", "created_at")
    search_fields = ("project__name", "user__email")
    autocomplete_fields = ("project", "user")
