from datetime import date

from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from masters.models import MenuMaster
from staff.models import StaffDetails, StaffMenuPermission


class InquiryMasterLookupAccessTests(APITestCase):
    lookup_urls = (
        "/api/product-types/",
        "/api/rating-types/",
        "/api/status-types/",
        "/api/source-types/",
    )

    def setUp(self):
        self.user = User.objects.create_user(username="inquiry-user")
        self.staff = StaffDetails.objects.create(
            Full_Name="Inquiry User",
            Designation="Sales",
            Email_Address="inquiry@example.com",
            Phone_Number="9999999999",
            Hire_Date=date(2026, 1, 1),
            Role="Staff",
            Is_Active=True,
            User_Id=self.user,
        )
        inquiry_menu = MenuMaster.objects.create(Menu_Name="Add Inquiry")
        StaffMenuPermission.objects.create(
            Staff=self.staff,
            Menu=inquiry_menu,
            Can_View=True,
            Can_Add=True,
        )
        self.client.force_authenticate(self.user)

    def test_add_inquiry_user_can_read_required_master_lists(self):
        for url in self.lookup_urls:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)

    def test_add_inquiry_user_cannot_create_master_records(self):
        response = self.client.post(
            "/api/source-types/",
            {"source_type_name": "Unauthorized source"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
