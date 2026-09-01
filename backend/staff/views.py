from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import StaffDetails, StaffMenuPermission
from masters.models import MenuMaster
from .access import HasMenuPermission, get_staff, has_full_access, serialize_menu_access
from .serializers import (
    StaffDetailsSerializer,
    StaffMenuPermissionSerializer
)


# ============================================================
# Staff Details API
# ============================================================

class StaffDetailsViewSet(viewsets.ModelViewSet):

    queryset = (
        StaffDetails.objects
        .select_related(
            "User_Id",
            "Created_By"
        )
        .prefetch_related(
            "MenuPermissions__Menu"
        )
        .all()
    )

    serializer_class = StaffDetailsSerializer

    permission_classes = [
        IsAuthenticated,
        HasMenuPermission,
    ]
    menu_names = ("Staff List", "Add Staff")

    # ========================================================
    # Logged-in User Menu Permissions
    # ========================================================

    @action(
        detail=False,
        methods=["get"],
        url_path="my-menus"
    )
    def my_menus(self, request):

        # ----------------------------------------------------
        # Find StaffDetails for logged-in Django User
        # ----------------------------------------------------

        staff = get_staff(request.user)

        # A Django superuser must receive the complete menu tree even when
        # its linked staff record has no menu-permission rows.
        if has_full_access(request.user, staff):
            menus = MenuMaster.objects.filter(Is_Active=True).order_by(
                "Display_Order", "Id"
            )
            return Response([
                serialize_menu_access(menu, full_access=True) for menu in menus
            ])

        # No staff record
        if not staff:
            return Response([])

        # ----------------------------------------------------
        # Get only allowed menus
        # ----------------------------------------------------

        permissions = (
            StaffMenuPermission.objects
            .filter(
                Staff=staff,
                Can_View=True,
                Menu__Is_Active=True
            )
            .select_related("Menu")
            .order_by("Menu__Display_Order")
        )

        # ----------------------------------------------------
        # Convert to response
        # ----------------------------------------------------

        data_by_id = {}

        for permission in permissions:
            menu = permission.Menu
            data_by_id[menu.Id] = serialize_menu_access(menu, permission)

            parent = menu.Parent_Id
            while parent and parent.Is_Active:
                data_by_id.setdefault(
                    parent.Id,
                    serialize_menu_access(parent),
                )
                data_by_id[parent.Id]["Can_View"] = True
                parent = parent.Parent_Id

        data = sorted(
            data_by_id.values(),
            key=lambda item: (item["Display_Order"], item["Id"]),
        )

        return Response(data)


# ============================================================
# Staff Menu Permission API
# ============================================================

class StaffMenuPermissionViewSet(viewsets.ModelViewSet):

    queryset = (
        StaffMenuPermission.objects
        .select_related(
            "Staff",
            "Menu"
        )
        .all()
    )

    serializer_class = StaffMenuPermissionSerializer

    permission_classes = [IsAuthenticated, HasMenuPermission]
    menu_names = ("Staff List", "Add Staff")
