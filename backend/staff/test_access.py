from types import SimpleNamespace

from django.test import SimpleTestCase

from staff.access import HasMenuPermission, has_full_access, serialize_menu_access


class StaffAccessTests(SimpleTestCase):
    def test_any_active_staff_user_can_load_their_own_menu_permissions(self):
        staff = SimpleNamespace(Is_Active=True, Role="Sales")
        user = SimpleNamespace(
            is_authenticated=True,
            is_superuser=False,
            staff_details=staff,
        )
        request = SimpleNamespace(user=user, method="GET")
        view = SimpleNamespace(action="my_menus")

        self.assertTrue(HasMenuPermission().has_permission(request, view))

    def test_only_admin_roles_and_superusers_have_full_access(self):
        self.assertTrue(has_full_access(SimpleNamespace(is_superuser=True), None))
        self.assertTrue(
            has_full_access(
                SimpleNamespace(is_superuser=False),
                SimpleNamespace(Role="Admin"),
            )
        )
        self.assertTrue(
            has_full_access(
                SimpleNamespace(is_superuser=False),
                SimpleNamespace(Role="Super Admin"),
            )
        )
        self.assertFalse(
            has_full_access(
                SimpleNamespace(is_superuser=True),
                SimpleNamespace(Role="Sales"),
            )
        )

    def test_menu_access_includes_all_action_flags(self):
        menu = SimpleNamespace(
            Id=8,
            Menu_Name="Customer List",
            Icon="customers",
            parent_id=2,
            Display_Order=3,
            Is_Active=True,
        )
        permission = SimpleNamespace(
            Menu=menu,
            Can_View=True,
            Can_Add=False,
            Can_Edit=True,
            Can_Delete=False,
        )

        self.assertEqual(
            serialize_menu_access(menu, permission),
            {
                "Id": 8,
                "Menu_Name": "Customer List",
                "Icon": "customers",
                "parent_id": 2,
                "Display_Order": 3,
                "Is_Active": True,
                "Can_View": True,
                "Can_Add": False,
                "Can_Edit": True,
                "Can_Delete": False,
            },
        )
