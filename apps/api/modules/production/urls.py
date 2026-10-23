from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ProductionRecordViewSet, ProductViewSet, SaleViewSet

router = DefaultRouter()
router.register("products", ProductViewSet, basename="product")
router.register("records", ProductionRecordViewSet, basename="production-record")
router.register("sales", SaleViewSet, basename="sale")

urlpatterns = [path("", include(router.urls))]
