from rest_framework.routers import DefaultRouter

from .views import (
    StaffDetailsViewSet,
    StaffMenuPermissionViewSet
)


router = DefaultRouter()

router.register(
    r"staff",
    StaffDetailsViewSet,
    basename="staff"
)

router.register(
    r"staff-menu-permissions",
    StaffMenuPermissionViewSet,
    basename="staff-menu-permissions"
)


urlpatterns = router.urls