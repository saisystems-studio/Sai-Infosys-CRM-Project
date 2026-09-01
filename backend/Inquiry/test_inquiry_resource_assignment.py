from datetime import date

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from Inquiry.serializers import InquiryCreateSerializer
from staff.models import StaffDetails


class InquiryResourceAssignmentTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.staff_user, self.staff = self.make_staff("sales", "Sales Person", "Sales")
        self.other_user, self.other_staff = self.make_staff("other", "Other Person", "Staff")
        self.admin_user, self.admin = self.make_staff("admin-user", "Admin Person", "Admin")
        self.super_user, self.super_staff = self.make_staff("super-user", "Super Person", "Super Admin")

    def make_staff(self, username, name, role):
        user = User.objects.create_user(username=username)
        staff = StaffDetails.objects.create(
            User_Id=user,
            Full_Name=name,
            Designation="Consultant",
            Email_Address=f"{username}@example.com",
            Phone_Number="9999999999",
            Hire_Date=date(2026, 1, 1),
            Role=role,
            Is_Active=True,
        )
        return user, staff

    def serializer_for(self, user):
        request = self.factory.post("/api/inquiries/")
        request.user = user
        return InquiryCreateSerializer(context={"request": request})

    def test_regular_staff_assignment_is_forced_to_logged_in_staff(self):
        attrs = self.serializer_for(self.staff_user).validate({"resource_id": self.other_staff.pk})

        self.assertEqual(attrs["resource_id"], self.staff.pk)

    def test_admin_can_assign_another_staff_resource(self):
        attrs = self.serializer_for(self.admin_user).validate({"resource_id": self.other_staff.pk})

        self.assertEqual(attrs["resource_id"], self.other_staff.pk)

    def test_super_admin_can_assign_another_staff_resource(self):
        attrs = self.serializer_for(self.super_user).validate({"resource_id": self.other_staff.pk})

        self.assertEqual(attrs["resource_id"], self.other_staff.pk)
