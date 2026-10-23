from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from modules.core.views import health_check

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/health/", health_check, name="health-check"),
    path("api/v1/auth/", include("modules.accounts.urls")),
    path("api/v1/projects/", include("modules.projects.urls")),
    path("api/v1/finance/", include("modules.finance.urls")),
    path("api/v1/production/", include("modules.production.urls")),
    path("api/v1/payroll/", include("modules.payroll.urls")),
    path("api/v1/reports/", include("modules.reports.urls")),
]

if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )
