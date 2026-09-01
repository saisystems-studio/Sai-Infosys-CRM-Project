from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response

from .models import StaffDetails, StaffDocument, StaffMenuPermission
from masters.models import MenuMaster
from .access import (
    HasMenuPermission,
    get_staff,
    has_full_access,
    menu_permission,
    serialize_menu_access,
)
from .serializers import (
    StaffDetailsSerializer,
    StaffMenuPermissionSerializer
)


class CanEditStaffDocuments(BasePermission):
    message = "You do not have permission to delete staff documents."

    def has_permission(self, request, view):
        staff = get_staff(request.user)
        if has_full_access(request.user, staff):
            return True
        if staff is None or not staff.Is_Active:
            return False
        return StaffMenuPermission.objects.filter(
            Staff=staff,
            Menu__Menu_Name__in=("Staff List", "Add Staff"),
            Menu__Is_Active=True,
            Can_View=True,
            Can_Edit=True,
        ).exists()


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
            "MenuPermissions__Menu",
            "Documents",
        )
        .all()
    )

    serializer_class = StaffDetailsSerializer

    permission_classes = [
        IsAuthenticated,
        HasMenuPermission,
    ]
    menu_names = ("Staff List", "Add Staff")

    def _get_document(self, staff_id, document_id):
        return get_object_or_404(
            StaffDocument,
            Staff_Id_id=staff_id,
            pk=document_id,
        )

    @action(
        detail=True,
        methods=["get"],
        url_path=r"documents/(?P<document_id>[^/.]+)/download",
        url_name="document-download",
        permission_classes=[
            IsAuthenticated,
            menu_permission("Staff List"),
        ],
    )
    def document_download(self, request, pk=None, document_id=None):
        document = self._get_document(pk, document_id)
        return FileResponse(
            document.Document_File.open("rb"),
            as_attachment=True,
            filename=document.Original_Name,
            content_type=document.Mime_Type,
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path=r"documents/(?P<document_id>[^/.]+)",
        url_name="document-delete",
        permission_classes=[IsAuthenticated, CanEditStaffDocuments],
    )
    def document_delete(self, request, pk=None, document_id=None):
        document = self._get_document(pk, document_id)
        document.delete()
        return Response(status=204)

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
