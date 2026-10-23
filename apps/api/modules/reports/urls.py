from django.urls import path

from .views import DashboardReportView

app_name = "reports"

urlpatterns = [
    path("dashboard/", DashboardReportView.as_view(), name="dashboard"),
]
