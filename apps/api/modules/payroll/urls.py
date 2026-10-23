from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import EmployeeViewSet, PayrollPeriodViewSet, SalaryRateViewSet, WorkEntryViewSet

router = DefaultRouter()
router.register("employees", EmployeeViewSet, basename="employee")
router.register("salary-rates", SalaryRateViewSet, basename="salary-rate")
router.register("work-entries", WorkEntryViewSet, basename="work-entry")
router.register("periods", PayrollPeriodViewSet, basename="payroll-period")

urlpatterns = [path("", include(router.urls))]
