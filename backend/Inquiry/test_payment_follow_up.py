from datetime import date

from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from Customers.models import CustomerDetails
from Inquiry.models import InquiryDetails_tbl, InquiryProductDetails_tbl, PaymentFollowUp
from staff.models import StaffDetails


class PaymentFollowUpApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="followup-admin")
        self.staff = StaffDetails.objects.create(
            Full_Name="Admin", Designation="Admin", Email_Address="admin@example.com",
            Phone_Number="9999999999", Hire_Date=date(2026, 1, 1),
            Role="Admin", Is_Active=True, User_Id=self.user,
        )
        customer = CustomerDetails.objects.create(
            customer_code="FOLLOWUP", customer_name="Customer", created_by=self.user,
        )
        inquiry = InquiryDetails_tbl.objects.create(
            Customer_Id=customer, Shedule_Date=date(2026, 9, 8), Created_Id=self.user,
        )
        self.product = InquiryProductDetails_tbl.objects.create(
            Inquiry_Id=inquiry, Quantity=1, Rate=100, Amount=100,
        )
        self.other_product = InquiryProductDetails_tbl.objects.create(
            Inquiry_Id=inquiry, Quantity=1, Rate=200, Amount=200,
        )
        self.url = f"/api/inquiries/payment-pending/{self.product.pk}/follow-up/"
        self.client.force_authenticate(self.user)

    def test_saved_history_can_be_reopened_without_losing_old_entries(self):
        for kind, day in [("call", "2026-09-08"), ("email", "2026-09-09"), ("meeting", "2026-09-10")]:
            response = self.client.post(self.url, {
                "FollowUp_Date": day, "FollowUp_Type": kind, "Notes": f"Arrange {kind}",
            }, format="json")
            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.data.get("FollowUp_Type"), kind)
        PaymentFollowUp.objects.create(
            Inquiry_Product=self.other_product, Customer=self.product.Inquiry_Id.Customer_Id,
            FollowUp_Date=date(2026, 9, 11), Notes="Other product", Created_By=self.user,
        )
        for _ in range(2):
            response = self.client.get(self.url)
            self.assertEqual(response.status_code, 200)
            self.assertEqual([row["Notes"] for row in response.data],
                             ["Arrange meeting", "Arrange email", "Arrange call"])
            self.assertEqual([row["FollowUp_Type"] for row in response.data],
                             ["meeting", "email", "call"])

    def test_invalid_type_is_rejected(self):
        response = self.client.post(self.url, {
            "FollowUp_Date": "2026-09-08", "FollowUp_Type": "invalid",
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(PaymentFollowUp.objects.count(), 0)

    def test_empty_history(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])

    def test_staff_cannot_read_or_save_payment_follow_ups(self):
        self.staff.Role = "Staff"
        self.staff.save()
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.assertEqual(self.client.post(self.url, {}).status_code, 403)
