from datetime import date

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from Customers.models import CustomerDetails
from Inquiry.models import ProductBilling
from masters.models import LicenseTypeMaster, MenuMaster, ProductTypeMaster
from staff.models import StaffDetails, StaffMenuPermission


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

    def test_bill_saves_each_product_revenue_amount(self):
        response = self.client.post("/api/product-billing/", {
            "customer_id": self.customer.id,
            "products": [
                {"product_id": self.product.Id, "rate": "2500", "quantity": "1", "amount": "2500", "revenue_amount": revenue}
                for revenue in ("500.25", "0.00")
            ],
        }, format="json")
        self.assertEqual(response.status_code, 201)
        bills = ProductBilling.objects.filter(Id__in=response.data["ids"]).order_by("Id")
        self.assertEqual([str(bill.Revenue_Amount) for bill in bills], ["500.25", "0.00"])
        listed = self.client.get("/api/product-billing/").data
        self.assertEqual(str(next(row for row in listed if row["id"] == bills[0].Id)["revenue_amount"]), "500.25")

    def test_invalid_revenue_rejects_the_whole_bill(self):
        for revenue in ("-1", "NaN", "Infinity", "abc", "1.001", "10000000000"):
            with self.subTest(revenue=revenue):
                response = self.client.post("/api/product-billing/", {
                    "customer_id": self.customer.id,
                    "products": [
                        {"product_id": self.product.Id, "rate": "2500", "quantity": "1", "amount": "2500", "revenue_amount": "100"},
                        {"product_id": self.product.Id, "rate": "2500", "quantity": "1", "amount": "2500", "revenue_amount": revenue},
                    ],
                }, format="json")
                self.assertEqual(response.status_code, 400)
                self.assertEqual(ProductBilling.objects.count(), 0)

    def test_lookup_searches_by_phone_or_company_name(self):
        """Autocomplete results include the contact needed to create a bill."""
        for query in ("9876", "billing company"):
            response = self.client.get(
                "/api/product-billing/customer-lookup/",
                {"query": query},
            )

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["results"], [{
                "customer_id": self.customer.id,
                "contact_number": "9876543210",
                "customer_name": "Billing Customer",
                "company_name": "Billing Company",
            }])

    def test_lookup_searches_by_customer_name(self):
        response = self.client.get(
            "/api/product-billing/customer-lookup/",
            {"query": "billing customer"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["results"][0]["customer_id"], self.customer.id)

    def test_lookup_can_load_a_customer_without_a_contact(self):
        customer = CustomerDetails.objects.create(
            customer_code="BILL002",
            customer_name="Contactless Customer",
            created_by=get_user_model().objects.get(username="billing-admin"),
        )

        response = self.client.get(
            "/api/product-billing/customer-lookup/",
            {"customer_id": customer.id},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["customer_id"], customer.id)
        self.assertEqual(response.json()["contact_number"], "")

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

    def test_staff_with_product_billing_view_permission_can_open_the_page(self):
        staff_user = get_user_model().objects.create_user(
            username="billing-staff",
            password="test-password",
        )
        staff = StaffDetails.objects.create(
            Full_Name="Billing Staff",
            Designation="Developer",
            Email_Address="billing-staff@example.com",
            Phone_Number="9876543211",
            Hire_Date=date(2026, 1, 1),
            Role="Developer",
            User_Id=staff_user,
            Created_By=self.customer.created_by,
        )
        menu = MenuMaster.objects.create(
            Menu_Name="Product Billing",
            Is_Active=True,
        )
        StaffMenuPermission.objects.create(
            Staff=staff,
            Menu=menu,
            Can_View=True,
            Can_Add=True,
        )
        self.client.force_authenticate(user=staff_user)

        response = self.client.get("/api/product-billing/")

        self.assertEqual(response.status_code, 200)

        response = self.client.get(
            "/api/product-billing/customer-lookup/",
            {"query": "billing customer"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["results"][0]["customer_id"], self.customer.id)

    def test_saved_product_bill_appears_in_payment_pending(self):
        bill = ProductBilling.objects.create(
            Customer_Id=self.customer,
            Contact_Number="9876543210",
            Customer_Name=self.customer.customer_name,
            Company_Name=self.customer.company_name,
            Product_Id=self.product,
            Rate="2500.00",
            Quantity="1.00",
            Amount="2500.00",
            Created_By=get_user_model().objects.get(username="billing-admin"),
        )

        response = self.client.get("/api/inquiries/payment-pending/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(any(
            row["source"] == "product_billing"
            and row["id"] == f"billing-{bill.Id}"
            and row["remaining_balance"] == "2500.00"
            for row in response.json()
        ))

    def test_pending_product_bills_use_revenue_for_collection_balance(self):
        for revenue, expected, remaining in (("2400.00", "2400.00", "1400.00"), ("0.00", "0.00", None), (None, "5528.48", "4528.48")):
            with self.subTest(revenue=revenue):
                bill = ProductBilling.objects.create(
                    Customer_Id=self.customer, Product_Id=self.product,
                    Rate="2536.00", Quantity="2.00", Amount="5072.00",
                    GST="456.48", Total_Paid="1000.00", Revenue_Amount=revenue,
                    Created_By=get_user_model().objects.get(username="billing-admin"),
                )
                response = self.client.get("/api/inquiries/payment-pending/")
                self.assertEqual(response.status_code, 200)
                if remaining is None:
                    self.assertFalse(any(row["id"] == f"billing-{bill.Id}" for row in response.json()))
                    continue
                row = next(row for row in response.json() if row["id"] == f"billing-{bill.Id}")
                self.assertEqual(row["revenue_amount"], expected)
                self.assertEqual(row["amount"], "5528.48")
                self.assertEqual(row["remaining_balance"], remaining)

    def test_product_bill_payment_updates_its_pending_balance(self):
        bill = ProductBilling.objects.create(
            Customer_Id=self.customer, Contact_Number="9876543210",
            Customer_Name=self.customer.customer_name, Company_Name=self.customer.company_name,
            Product_Id=self.product, Rate="2500.00", Quantity="1.00", Amount="2500.00",
            Revenue_Amount="2400.00",
            Created_By=get_user_model().objects.get(username="billing-admin"),
        )

        response = self.client.post(
            f"/api/inquiries/payment-pending/billing-{bill.Id}/paid/",
            {"amount": "1000.00", "payment_type": "installment"}, format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["remaining_balance"], "1400.00")
        bill.refresh_from_db()
        self.assertEqual(str(bill.Total_Paid), "1000.00")
        self.assertEqual(bill.Payment_Status, "Pending")

        approvals = self.client.get("/api/inquiries/payment-approvals/")
        self.assertEqual(approvals.status_code, 200)
        self.assertEqual(len(approvals.json()), 1)
        payment = approvals.json()[0]
        self.assertEqual(payment["revenue_amount"], "2400.00")
        self.assertEqual(payment["invoice_amount"], "2500.00")
        self.assertEqual(payment["payment_amount"], "1000.00")
        self.assertEqual(payment["remaining_balance"], "1400.00")
        self.assertEqual(payment["company_name"], self.customer.company_name)
        self.assertEqual(payment["product_name"], "TSS")
        self.assertEqual(payment["approval_status"], "Pending")

        staff = StaffDetails.objects.get(User_Id=bill.Created_By)
        staff.Role = "Super Admin"
        staff.save(update_fields=["Role"])
        self.client.force_authenticate(user=get_user_model().objects.get(pk=bill.Created_By_id))
        received = self.client.post(f"/api/inquiries/payment-approvals/{payment['id']}/received/")
        self.assertEqual(received.status_code, 200)
        report = self.client.get("/api/inquiries/payment-received-details/")
        self.assertEqual(report.status_code, 200)
        self.assertEqual(report.json()[0]["payment_amount"], "1000.00")
        self.assertEqual(report.json()[0]["revenue_amount"], "2400.00")
        bill.refresh_from_db()
        self.assertEqual(str(bill.Total_Paid), "1000.00")

        overpayment = self.client.post(
            f"/api/inquiries/payment-pending/billing-{bill.Id}/paid/",
            {"amount": "1500.00", "payment_type": "installment"}, format="json",
        )
        self.assertEqual(overpayment.status_code, 400)
        final = self.client.post(
            f"/api/inquiries/payment-pending/billing-{bill.Id}/paid/",
            {"amount": "1400.00", "payment_type": "full"}, format="json",
        )
        self.assertEqual(final.status_code, 200)
        bill.refresh_from_db()
        self.assertEqual(bill.Payment_Status, "Pending")
        approvals = self.client.get("/api/inquiries/payment-approvals/").json()
        self.assertEqual(len(approvals), 2)
        pending = next(row for row in approvals if row["approval_status"] == "Pending")
        received = self.client.post(f"/api/inquiries/payment-approvals/{pending['id']}/received/")
        self.assertEqual(received.status_code, 200)
        bill.refresh_from_db()
        self.assertEqual(bill.Payment_Status, "Received")
        self.assertEqual(str(bill.Total_Paid), "2400.00")
        duplicate = self.client.post(f"/api/inquiries/payment-approvals/{pending['id']}/received/")
        self.assertEqual(duplicate.status_code, 400)

    def test_recover_previous_product_bill_payment_without_changing_balance(self):
        import importlib
        from django.apps import apps
        from django.db import connection
        from types import SimpleNamespace

        bill = ProductBilling.objects.create(
            Customer_Id=self.customer, Contact_Number="9876543210",
            Product_Id=self.product, Rate="4905.00", Quantity="1.00", Amount="4905.00",
            Total_Paid="2000.00", Created_By=get_user_model().objects.get(username="billing-admin"),
        )
        migration = importlib.import_module("Inquiry.migrations.0021_recover_product_bill_payments")
        editor = SimpleNamespace(connection=connection)
        migration.recover_payments(apps, editor)
        migration.recover_payments(apps, editor)
        response = self.client.get("/api/inquiries/payment-approvals/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        payment = response.json()[0]
        self.assertEqual(payment["payment_amount"], "2000.00")
        self.assertEqual(payment["remaining_balance"], "2905.00")
        self.assertIsNone(payment["payment_date"])
        self.assertEqual(payment["approval_status"], "Pending")
        bill.refresh_from_db()
        self.assertEqual(str(bill.Total_Paid), "2000.00")

    def test_product_bill_can_save_and_list_payment_follow_ups(self):
        bill = ProductBilling.objects.create(
            Customer_Id=self.customer, Contact_Number="9876543210",
            Customer_Name=self.customer.customer_name, Company_Name=self.customer.company_name,
            Product_Id=self.product, Rate="2500.00", Quantity="1.00", Amount="2500.00",
            Created_By=get_user_model().objects.get(username="billing-admin"),
        )

        response = self.client.post(
            f"/api/inquiries/payment-pending/billing-{bill.Id}/follow-up/",
            {"FollowUp_Date": "2026-10-01", "FollowUp_Type": "call", "Notes": "Call customer for payment."},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["Notes"], "Call customer for payment.")
        history = self.client.get(
            f"/api/inquiries/payment-pending/billing-{bill.Id}/follow-up/",
        )
        self.assertEqual(history.status_code, 200)
        self.assertEqual(len(history.json()), 1)
