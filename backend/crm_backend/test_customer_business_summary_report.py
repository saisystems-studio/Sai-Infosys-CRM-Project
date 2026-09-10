from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from Customers.models import CustomerDetails
from Inquiry.models import InquiryDetails_tbl, InquiryProductDetails_tbl, PaymentDetail
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
