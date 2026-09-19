from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from Customers.models import CustomerDetails
from masters.models import LicenseTypeMaster, MenuMaster
from staff.models import StaffDetails, StaffMenuPermission


class LicenseExpiryReportTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="report-admin",
            password="test-password",
        )
        StaffDetails.objects.create(
            Full_Name="Report Admin",
            Designation="Administrator",
            Email_Address="report-admin@example.com",
            Phone_Number="9876543210",
            Hire_Date=date(2026, 1, 1),
            Role="Super Admin",
            User_Id=self.user,
            Created_By=self.user,
        )
        self.customer = CustomerDetails.objects.create(
            customer_code="LIC001",
            customer_name="Expiry Contact",
            company_name="Expiry Company",
            created_by=self.user,
        )
        self.customer.contacts.create(
            contact_name="Expiry Contact",
            contact_number="9876543210",
            created_by=self.user,
        )
        self.tally_prime = LicenseTypeMaster.objects.create(
            license_type_name="Tally Prime",
            created_by=self.user,
        )
        self.tally_gold = LicenseTypeMaster.objects.create(
            license_type_name="Tally Gold",
            created_by=self.user,
        )
        self.current_month_license = self.customer.licenses.create(
            tally_serial_number="123456789",
            license_type=self.tally_prime,
            expiry_date=date(2026, 9, 30),
            created_by=self.user,
        )
        self.customer.licenses.create(
            tally_serial_number="987654321",
            license_type=self.tally_gold,
            expiry_date=date(2026, 10, 1),
            created_by=self.user,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_returns_expiring_licences_for_date_range_with_product_filter(self):
        """The report exposes company, contact, licence type, serial, and expiry."""
        response = self.client.get(
            "/api/license-expiry-report/",
            {
                "from_date": "2026-09-01",
                "to_date": "2026-09-30",
                "product_id": self.tally_prime.Id,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "products": [{"id": self.tally_gold.Id, "name": "Tally Gold"}, {"id": self.tally_prime.Id, "name": "Tally Prime"}],
            "rows": [{
                "id": self.current_month_license.id,
                "company_name": "Expiry Company",
                "contact_number": "9876543210",
                "product_id": self.tally_prime.Id,
                "product_name": "Tally Prime",
                "serial_number": "123456789",
                "expiry_date": "2026-09-30",
            }],
        })

    def test_rejects_an_invalid_date_range(self):
        response = self.client.get(
            "/api/license-expiry-report/",
            {"from_date": "2026-10-01", "to_date": "2026-09-01"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "From date cannot be after to date.")

    def test_staff_with_view_permission_can_access_the_report(self):
        staff_user = get_user_model().objects.create_user(
            username="report-staff",
            password="test-password",
        )
        staff = StaffDetails.objects.create(
            Full_Name="Report Staff",
            Designation="Developer",
            Email_Address="report-staff@example.com",
            Phone_Number="9876543211",
            Hire_Date=date(2026, 1, 1),
            Role="Developer",
            User_Id=staff_user,
            Created_By=self.user,
        )
        menu = MenuMaster.objects.create(
            Menu_Name="Licence Expiry Report",
            Is_Active=True,
        )
        StaffMenuPermission.objects.create(
            Staff=staff,
            Menu=menu,
            Can_View=True,
        )
        self.client.force_authenticate(user=staff_user)

        response = self.client.get(
            "/api/license-expiry-report/",
            {"from_date": "2026-09-01", "to_date": "2026-09-30"},
        )

        self.assertEqual(response.status_code, 200)
