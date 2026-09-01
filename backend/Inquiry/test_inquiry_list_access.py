from datetime import date

from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from Customers.models import CustomerDetails
from Inquiry.models import InquiryDetails_tbl
from masters.models import MenuMaster
from staff.models import StaffDetails, StaffMenuPermission


class InquiryListAccessTests(APITestCase):
    def setUp(self):
        self.staff_user, self.staff = self.make_staff("list-staff", "List Staff", "Staff")
        self.other_user, self.other_staff = self.make_staff("list-other", "Other Staff", "Sales")
        self.admin_user, self.admin = self.make_staff("list-admin", "List Admin", "Admin")
        self.super_user, self.super_staff = self.make_staff("list-super", "List Super", "Super Admin")
        menu = MenuMaster.objects.create(Menu_Name="Inquiry List", Is_Active=True)
        for staff in (self.staff, self.other_staff):
            StaffMenuPermission.objects.create(Staff=staff, Menu=menu, Can_View=True)
        self.customer = CustomerDetails.objects.create(
            customer_code="LIST-ACCESS",
            customer_name="List Access Customer",
            created_by=self.admin_user,
        )
        self.own_inquiry = self.make_inquiry(self.staff, self.staff_user)
        self.other_inquiry = self.make_inquiry(self.other_staff, self.other_user)

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

    def make_inquiry(self, resource, creator):
        return InquiryDetails_tbl.objects.create(
            Customer_Id=self.customer,
            Shedule_Date=date(2026, 9, 1),
            Resource_Id=resource,
            Created_Id=creator,
        )

    def test_regular_staff_list_contains_only_assigned_inquiries(self):
        self.client.force_authenticate(self.staff_user)

        response = self.client.get("/api/inquiries/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["id"] for row in response.data], [self.own_inquiry.pk])

    def test_regular_staff_cannot_retrieve_another_staff_inquiry(self):
        self.client.force_authenticate(self.staff_user)

        response = self.client.get(f"/api/inquiries/{self.other_inquiry.pk}/")

        self.assertEqual(response.status_code, 404)

    def test_admin_and_super_admin_lists_contain_all_inquiries(self):
        for user in (self.admin_user, self.super_user):
            self.client.force_authenticate(user)
            response = self.client.get("/api/inquiries/")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(
                {row["id"] for row in response.data},
                {self.own_inquiry.pk, self.other_inquiry.pk},
            )
