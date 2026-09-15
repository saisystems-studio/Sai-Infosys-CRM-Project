from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from Customers.models import CustomerDetails
from masters.models import LicenseTypeMaster, ProductTypeMaster
from staff.models import StaffDetails


class ProductBillingCustomerLookupTests(TestCase):
    def setUp(self):
        user = get_user_model().objects.create_user(
            username="billing-admin",
            password="test-password",
        )
        StaffDetails.objects.create(
            Full_Name="Billing Admin",
            Designation="Administrator",
            Email_Address="billing-admin@example.com",
            Phone_Number="9876543210",
            Hire_Date=date(2026, 1, 1),
            Role="Admin",
            User_Id=user,
            Created_By=user,
        )
        self.customer = CustomerDetails.objects.create(
            customer_code="BILL001",
            customer_name="Billing Customer",
            company_name="Billing Company",
            created_by=user,
        )
        self.customer.contacts.create(
            contact_name="Billing Contact",
            contact_number="9876543210",
            created_by=user,
        )
        license_type = LicenseTypeMaster.objects.create(
            license_type_name="Tally Prime",
            created_by=user,
        )
        self.product = ProductTypeMaster.objects.create(
            product_type_name="TSS",
            created_by=user,
        )
        self.license = self.customer.licenses.create(
            tally_serial_number="123456789",
            license_type=license_type,
            expiry_date=date(2027, 6, 30),
            created_by=user,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=user)

    def save_bill(self, license_type_id, expiry_date, admin_id=""):
        return self.client.post(
            "/api/product-billing/",
            {
                "customer_id": self.customer.id,
                "contact_number": "9876543210",
                "license_id": self.license.id,
                "license_type_id": license_type_id,
                "license_admin_id": admin_id,
                "license_expiry_date": expiry_date,
                "license_details": self.license.tally_serial_number,
                "product_id": self.product.Id,
                "rate": "2500",
                "quantity": "1",
                "amount": "2500",
            },
            format="json",
        )

    def test_lookup_returns_selectable_license_details(self):
        """Fails if lookup sends display strings instead of form-ready licenses."""
        response = self.client.get(
            "/api/product-billing/customer-lookup/",
            {"contact_number": "9876543210"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["license_options"],
            [{
                "id": self.license.id,
                "serial_number": "123456789",
                "license_type_id": self.license.license_type_id,
                "admin_id": "",
                "expiry_date": "2027-06-30",
            }],
        )

    def test_saving_same_license_type_updates_the_existing_expiry_date(self):
        """Fails if a renewal with the same type leaves the stored expiry unchanged."""
        response = self.save_bill(
            self.license.license_type_id,
            "2028-06-30",
            "renewed-admin@example.com",
        )

        self.assertEqual(response.status_code, 201)
        self.license.refresh_from_db()
        self.assertEqual(self.license.expiry_date, date(2028, 6, 30))
        self.assertEqual(self.license.admin_id, "renewed-admin@example.com")
        self.assertEqual(self.customer.licenses.count(), 1)

    def test_saving_changed_license_type_keeps_history_as_a_new_record(self):
        """Fails if changing Gold/Silver overwrites the prior license history."""
        silver = LicenseTypeMaster.objects.create(
            license_type_name="Silver",
            created_by=get_user_model().objects.get(username="billing-admin"),
        )

        response = self.save_bill(
            silver.Id,
            "2028-06-30",
            "silver-admin@example.com",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.customer.licenses.count(), 2)
        self.assertTrue(self.customer.licenses.filter(
            tally_serial_number="123456789",
            license_type=silver,
            admin_id="silver-admin@example.com",
            expiry_date=date(2028, 6, 30),
        ).exists())

    def test_saving_a_new_license_attaches_it_to_the_selected_customer(self):
        """Fails if new billing-license details are not persisted for this customer."""
        response = self.client.post(
            "/api/product-billing/",
            {
                "customer_id": self.customer.id,
                "contact_number": "9876543210",
                "is_new_license": True,
                "license_details": "987654321",
                "license_type_id": self.license.license_type_id,
                "license_admin_id": "new-admin@example.com",
                "license_expiry_date": "2028-06-30",
                "product_id": self.product.Id,
                "rate": "2500",
                "quantity": "1",
                "amount": "2500",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertTrue(self.customer.licenses.filter(
            tally_serial_number="987654321",
            license_type_id=self.license.license_type_id,
            admin_id="new-admin@example.com",
            expiry_date=date(2028, 6, 30),
        ).exists())
