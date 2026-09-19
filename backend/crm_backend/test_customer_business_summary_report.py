from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from Customers.models import CustomerDetails
from Inquiry.models import InquiryDetails_tbl, InquiryProductDetails_tbl, PaymentDetail, ProductBilling
from masters.models import (
    CustomerTypeMaster,
    ProductTypeMaster,
    SourceTypeMaster,
    StatusTypeMaster,
)
from staff.models import StaffDetails


class CustomerBusinessSummaryReportTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            username="report-super",
            password="test-password",
        )
        StaffDetails.objects.create(
            Full_Name="Report Super",
            Designation="Administrator",
            Email_Address="report-super@example.com",
            Phone_Number="9999999999",
            Hire_Date=date(2026, 1, 1),
            Role="Super Admin",
            User_Id=self.user,
            Created_By=self.user,
        )
        customer_type = CustomerTypeMaster.objects.create(
            customer_type_name="Corporate",
            created_by=self.user,
        )
        self.customer = CustomerDetails.objects.create(
            customer_code="R001",
            customer_name="Report Customer",
            company_name="Report Company",
            email_id="customer@example.com",
            customer_type=customer_type,
            created_by=self.user,
        )
        product = ProductTypeMaster.objects.create(
            product_type_name="CCTV",
            created_by=self.user,
        )
        source = SourceTypeMaster.objects.create(
            source_type_name="Website",
            created_by=self.user,
        )
        status_type = StatusTypeMaster.objects.create(
            status_type_name="Completed",
            created_by=self.user,
        )
        inquiry = InquiryDetails_tbl.objects.create(
            Customer_Id=self.customer,
            Shedule_Date=date(2026, 2, 1),
            Status_Id=status_type,
            Source_Id=source,
            Created_Id=self.user,
        )
        inquiry_product = InquiryProductDetails_tbl.objects.create(
            Inquiry_Id=inquiry,
            ProductType_Id=product,
            Quantity=1,
            Rate=Decimal("1000"),
            Amount=Decimal("1000"),
            Created_By=self.user,
        )
        PaymentDetail.objects.create(
            Inquiry_Product=inquiry_product,
            Amount=Decimal("750"),
            Payment_Type=PaymentDetail.PaymentType.FULL,
            Created_By=self.user,
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_report_returns_database_rows_and_expected_totals(self):
        response = self.client.get("/api/customer-business-summary/")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(len(payload["customers"]), 1)
        self.assertEqual(len(payload["inquiries"]), 1)
        self.assertEqual(len(payload["schedules"]), 1)
        self.assertEqual(payload["inquiries"][0]["expectedRevenue"], 1000.0)
        self.assertEqual(payload["transactions"][0]["amount"], 750.0)
        self.assertEqual(
            payload["transactions"][0]["inquiryId"], payload["inquiries"][0]["id"]
        )
        self.assertEqual(payload["schedules"][0]["status"], "Completed")
        self.assertEqual(payload["inquiries"][0]["product"], "CCTV")
        self.assertEqual(payload["inquiries"][0]["taskProgressCount"], 0)
        self.assertFalse(payload["inquiries"][0]["hasActiveTask"])

    def test_report_rejects_non_super_admin(self):
        self.user.staff_details.Role = "Admin"
        self.user.staff_details.save(update_fields=["Role"])

        response = self.client.get("/api/customer-business-summary/")

        self.assertEqual(response.status_code, 403)

    def test_report_allows_legacy_payment_without_a_payment_date(self):
        PaymentDetail.objects.update(Payment_Date=None)

        response = self.client.get("/api/customer-business-summary/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["transactions"][0]["date"], "")

    def test_report_includes_product_bills_and_their_payments_once(self):
        bill = ProductBilling.objects.create(
            Customer_Id=self.customer, Product_Id=ProductTypeMaster.objects.first(),
            Contact_Number="9999999999", License_Details="SERIAL-001",
            Rate=Decimal("1000"), Quantity=2, Amount=Decimal("2000"),
            Has_GST=True, GST_Percentage=18, GST=Decimal("360"),
            Total_Paid=Decimal("500"), Payment_Status="Partial", Created_By=self.user,
        )
        payment = PaymentDetail.objects.create(
            Product_Billing=bill, Amount=Decimal("500"),
            Payment_Type="installment", Created_By=self.user,
        )
        response = self.client.get("/api/customer-business-summary/")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        row = payload["productBills"][0]
        self.assertEqual(row["id"], f"b-{bill.pk}")
        self.assertEqual(row["customerId"], str(self.customer.pk))
        self.assertEqual(row["expectedRevenue"], 2360)
        self.assertEqual(row["totalPaid"], 500)
        self.assertEqual(row["balance"], 1860)
        self.assertEqual(row["serialNumber"], "SERIAL-001")
        self.assertEqual(row["quantity"], 2)
        self.assertEqual(row["date"], bill.Created_On.date().isoformat())
        self.assertEqual(len(payload["inquiries"]), 1)
        self.assertEqual(len(payload["transactions"]), 2)
        bill_payment = next(p for p in payload["transactions"] if p["id"] == f"p-{payment.pk}")
        self.assertEqual(bill_payment["billingId"], row["id"])
        self.assertEqual(bill_payment["amount"], 500)
        self.assertEqual(bill_payment["date"], payment.Payment_Date.date().isoformat())
