from rest_framework.permissions import BasePermission

from .models import StaffDetails, StaffMenuPermission


FULL_ACCESS_ROLES = {"admin", "super admin"}
METHOD_ACTIONS = {
    "GET": "Can_View", "HEAD": "Can_View", "OPTIONS": "Can_View",
    "POST": "Can_Add", "PUT": "Can_Edit", "PATCH": "Can_Edit",
    "DELETE": "Can_Delete",
}


def normalize_role(role):
    value = str(role or "").strip().lower().replace("_", " ").replace("-", " ")
    return " ".join(value.split())


def get_staff(user):
    if not user or not user.is_authenticated:
        return None
    try:
        return user.staff_details
    except StaffDetails.DoesNotExist:
        return None


def has_full_access(user, staff=None):
    if not user:
        return False
    if staff is not None:
        return normalize_role(staff.Role) in FULL_ACCESS_ROLES
    return bool(user.is_superuser)


def serialize_menu_access(menu, permission=None, full_access=False):
    return {
        "Id": menu.Id, "Menu_Name": menu.Menu_Name, "Icon": menu.Icon,
        "parent_id": getattr(menu, "Parent_Id_id", getattr(menu, "parent_id", None)),
        "Display_Order": menu.Display_Order,
        "Is_Active": menu.Is_Active,
        "Can_View": True if full_access else bool(permission and permission.Can_View),
        "Can_Add": True if full_access else bool(permission and permission.Can_Add),
        "Can_Edit": True if full_access else bool(permission and permission.Can_Edit),
        "Can_Delete": True if full_access else bool(permission and permission.Can_Delete),
    }


class HasMenuPermission(BasePermission):
    message = "You do not have permission to perform this action."

    def get_menu_names(self, request, view):
        return getattr(view, "menu_names", ()) or getattr(self, "menu_names", ())

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        staff = get_staff(request.user)
        if has_full_access(request.user, staff):
            return True
        if staff is None or not staff.Is_Active:
            return False
        if getattr(view, "action", None) == "my_menus":
            return True
        menu_names = self.get_menu_names(request, view)
        if isinstance(menu_names, str):
            menu_names = (menu_names,)
        required_action = METHOD_ACTIONS.get(request.method)
        if not menu_names or not required_action:
            return False
        filters = {
            "Staff": staff,
            "Menu__Menu_Name__in": menu_names,
            "Menu__Is_Active": True,
            "Can_View": True,
            required_action: True,
        }
        return StaffMenuPermission.objects.filter(**filters).exists()


def menu_permission(*menu_names):
    class ConfiguredMenuPermission(HasMenuPermission):
        def get_menu_names(self, request, view):
            return menu_names

    return ConfiguredMenuPermission


def master_lookup_permission(*master_menu_names):
    class MasterLookupPermission(HasMenuPermission):
        inquiry_menu_names = ("Inquiry List", "Add Inquiry")

        def get_menu_names(self, request, view):
            if request.method in ("GET", "HEAD", "OPTIONS"):
                return (*master_menu_names, *self.inquiry_menu_names)
            return master_menu_names

    return MasterLookupPermission
