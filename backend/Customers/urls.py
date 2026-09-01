from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CustomerDetailsViewSet

router = DefaultRouter()
router.register(r'customers', CustomerDetailsViewSet, basename='customer')

urlpatterns = [
    path('', include(router.urls)),
]