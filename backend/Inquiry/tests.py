from datetime import date
from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from Customers.models import CustomerDetails
from Inquiry.models import (
    InquiryDetails_tbl,
    InquiryProductDetails_tbl,
    PaymentDetail,
)
from Inquiry.payment_ledger import approve_payment_detail, record_payment
from staff.models import StaffDetails


class PaymentApprovalAccessTests(TestCase):
    def setUp(self):
        self.admin_user = User.objects.create_user(
            username="payment-admin",
            password="test-password",
        )
        StaffDetails.objects.create(
            User_Id=self.admin_user,
            Full_Name="Payment Admin",
            Designation="Administrator",
            Email_Address="payment-admin@example.com",
            Phone_Number="9999999999",
            Hire_Date=date.today(),
            Role="Admin",
        )
        customer = CustomerDetails.objects.create(
            customer_code="PAY-001",
            customer_name="Payment Customer",
            created_by=self.admin_user,
        )
        inquiry = InquiryDetails_tbl.objects.create(
            Customer_Id=customer,
            Shedule_Date=date.today(),
            Created_Id=self.admin_user,
        )
        self.pending_payment = InquiryProductDetails_tbl.objects.create(
            Inquiry_Id=inquiry,
            Quantity=1,
            Rate=100,
            Amount=100,
            Revenue_Amount=10,
            Payment_Status="Pending",
            Created_By=self.admin_user,
        )
        self.received_payment = InquiryProductDetails_tbl.objects.create(
            Inquiry_Id=inquiry,
            Quantity=1,
            Rate=200,
            Amount=200,
            Revenue_Amount=20,
            Payment_Status="Received",
            Created_By=self.admin_user,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin_user)

        self.super_admin_user = User.objects.create_user(
            username="payment-super-admin",
            password="test-password",
        )
        StaffDetails.objects.create(
            User_Id=self.super_admin_user,
            Full_Name="Payment Super Admin",
            Designation="Administrator",
            Email_Address="payment-super-admin@example.com",
            Phone_Number="8888888888",
            Hire_Date=date.today(),
            Role="Super Admin",
        )

        self.staff_user = User.objects.create_user(
            username="payment-staff",
            password="test-password",
        )
        StaffDetails.objects.create(
            User_Id=self.staff_user,
            Full_Name="Payment Staff",
            Designation="Sales",
            Email_Address="payment-staff@example.com",
            Phone_Number="7777777777",
            Hire_Date=date.today(),
            Role="Sales",
        )

    def test_payment_detail_keeps_an_individual_installment(self):
        """Fails if an installment cannot be preserved as a ledger row."""
        detail = PaymentDetail.objects.create(
            Inquiry_Product=self.pending_payment,
            Amount=Decimal("4.00"),
            Payment_Type=PaymentDetail.PaymentType.INSTALLMENT,
            Created_By=self.admin_user,
        )

        self.assertEqual(detail.Inquiry_Product_id, self.pending_payment.id)
        self.assertEqual(detail.Amount, Decimal("4.00"))
        self.assertEqual(detail.Payment_Type, "installment")

    def test_new_payment_detail_starts_pending_approval(self):
        """Fails if newly recorded transactions are not awaiting approval."""
        detail = PaymentDetail.objects.create(
            Inquiry_Product=self.pending_payment,
            Amount=Decimal("4.00"),
            Payment_Type=PaymentDetail.PaymentType.INSTALLMENT,
            Created_By=self.admin_user,
        )

        self.assertEqual(detail.Approval_Status, "Pending")
        self.assertIsNone(detail.Approved_By)
        self.assertIsNone(detail.Approved_On)

    def test_approving_one_installment_does_not_complete_the_product(self):
        """Fails if a partial approved payment completes the product."""
        first = PaymentDetail.objects.create(
            Inquiry_Product=self.pending_payment,
            Amount=Decimal("4.00"),
            Payment_Type=PaymentDetail.PaymentType.INSTALLMENT,
            Created_By=self.admin_user,
        )

        approve_payment_detail(
            payment_detail_id=first.pk,
            user=self.super_admin_user,
        )

        first.refresh_from_db()
        self.pending_payment.refresh_from_db()
        self.assertEqual(first.Approval_Status, "Received")
        self.assertEqual(self.pending_payment.Payment_Status, "Pending")

    def test_overall_status_changes_only_after_full_paid_balance_and_all_approvals(self):
        """Fails if the product completes before every payment is approved."""
        first = PaymentDetail.objects.create(
            Inquiry_Product=self.pending_payment,
            Amount=Decimal("4.00"),
            Payment_Type=PaymentDetail.PaymentType.INSTALLMENT,
            Created_By=self.admin_user,
        )
        second = PaymentDetail.objects.create(
            Inquiry_Product=self.pending_payment,
            Amount=Decimal("6.00"),
            Payment_Type=PaymentDetail.PaymentType.INSTALLMENT,
            Created_By=self.admin_user,
        )

        approve_payment_detail(
            payment_detail_id=first.pk,
            user=self.super_admin_user,
        )
        self.pending_payment.refresh_from_db()
        self.assertEqual(self.pending_payment.Payment_Status, "Pending")

        approve_payment_detail(
            payment_detail_id=second.pk,
            user=self.super_admin_user,
        )
        self.pending_payment.refresh_from_db()
        self.assertEqual(self.pending_payment.Payment_Status, "Received")

    def test_installment_reduces_remaining_balance_and_keeps_pending(self):
        """Fails if an installment incorrectly completes the payment."""
        product, total_paid, remaining = record_payment(
            product_id=self.pending_payment.id,
            user=self.admin_user,
            amount=Decimal("4.00"),
            payment_type="installment",
        )

        self.assertEqual(total_paid, Decimal("4.00"))
        self.assertEqual(remaining, Decimal("6.00"))
        self.assertEqual(product.Payment_Status, "Pending")

    def test_full_payment_requires_the_exact_remaining_balance(self):
        """Fails if a Full Payment can record less than the balance."""
        with self.assertRaises(ValidationError):
            record_payment(
                product_id=self.pending_payment.id,
                user=self.admin_user,
                amount=Decimal("9.00"),
                payment_type="full",
            )

    def test_overpayment_is_rejected_without_creating_a_detail(self):
        """Fails if an overpayment changes the payment ledger."""
        with self.assertRaises(ValidationError):
            record_payment(
                product_id=self.pending_payment.id,
                user=self.admin_user,
                amount=Decimal("11.00"),
                payment_type="installment",
            )

        self.assertFalse(self.pending_payment.payment_details.exists())

    def test_admin_can_list_only_outstanding_payment_records(self):
        """Fails if the pending endpoint omits an outstanding revenue payment."""
        response = self.client.get("/api/inquiries/payment-pending/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], self.pending_payment.id)
        self.assertEqual(response.data[0]["total_paid"], "0.00")
        self.assertEqual(response.data[0]["remaining_balance"], "10.00")

    def test_admin_can_record_an_installment_from_the_pending_page(self):
        """Fails if Admin cannot record a valid installment payment."""
        response = self.client.post(
            f"/api/inquiries/payment-pending/{self.pending_payment.id}/paid/",
            {"amount": "4.00", "payment_type": "installment"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["total_paid"], "4.00")
        self.assertEqual(response.data["remaining_balance"], "6.00")
        self.assertEqual(response.data["payment_status"], "Pending")

    def test_full_payment_stays_pending_until_super_admin_approves_it(self):
        """Fails if Admin payment entry marks a payment as Received."""
        response = self.client.post(
            f"/api/inquiries/payment-pending/{self.pending_payment.id}/paid/",
            {"amount": "10.00", "payment_type": "full"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["remaining_balance"], "0.00")
        self.pending_payment.refresh_from_db()
        self.assertEqual(self.pending_payment.Payment_Status, "Pending")
        self.assertEqual(PaymentDetail.objects.count(), 1)
        self.assertEqual(self.client.get("/api/inquiries/payment-pending/").data, [])

    def test_regular_staff_cannot_record_a_payment(self):
        """Fails if a non-finance staff member can create payment records."""
        self.client.force_authenticate(self.staff_user)

        response = self.client.post(
            f"/api/inquiries/payment-pending/{self.pending_payment.id}/paid/",
            {"amount": "4.00", "payment_type": "installment"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_regular_staff_cannot_view_pending_payments(self):
        """Fails if a non-finance staff member can view payment balances."""
        self.client.force_authenticate(self.staff_user)

        response = self.client.get("/api/inquiries/payment-pending/")

        self.assertEqual(response.status_code, 403)

    def test_received_action_approves_a_fully_paid_ledger_without_adding_a_payment(self):
        """Fails if Super Admin approval creates a payment instead of approving one."""
        detail = PaymentDetail.objects.create(
            Inquiry_Product=self.pending_payment,
            Amount=Decimal("10.00"),
            Payment_Type=PaymentDetail.PaymentType.FULL,
            Created_By=self.admin_user,
        )
        self.client.force_authenticate(self.super_admin_user)

        response = self.client.post(
            f"/api/inquiries/payment-approvals/{detail.Id}/received/"
        )

        self.assertEqual(response.status_code, 200)
        self.pending_payment.refresh_from_db()
        self.assertEqual(self.pending_payment.Payment_Status, "Received")
        self.assertEqual(PaymentDetail.objects.count(), 1)

    def test_super_admin_cannot_receive_a_nonexistent_payment_transaction(self):
        """Fails if approval accepts an ID that has no payment transaction."""
        self.client.force_authenticate(self.super_admin_user)

        response = self.client.post(
            f"/api/inquiries/payment-approvals/{self.pending_payment.id}/received/"
        )

        self.assertEqual(response.status_code, 404)
        self.assertFalse(self.pending_payment.payment_details.exists())

    def test_admin_can_view_pending_and_received_payment_statuses(self):
        """Fails if Admin users cannot view all payment approval statuses."""
        PaymentDetail.objects.create(
            Inquiry_Product=self.pending_payment,
            Amount=Decimal("4.00"),
            Payment_Type=PaymentDetail.PaymentType.INSTALLMENT,
            Created_By=self.admin_user,
        )
        PaymentDetail.objects.create(
            Inquiry_Product=self.received_payment,
            Amount=Decimal("20.00"),
            Payment_Type=PaymentDetail.PaymentType.FULL,
            Created_By=self.admin_user,
        )

        response = self.client.get("/api/inquiries/payment-approvals/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {payment["payment_status"] for payment in response.data},
            {"Pending", "Received"},
        )

    def test_payment_approval_includes_saved_payment_summary(self):
        """Fails if approval users cannot see payment data saved from Payment Pending."""
        PaymentDetail.objects.create(
            Inquiry_Product=self.pending_payment,
            Amount=Decimal("4.00"),
            Payment_Type=PaymentDetail.PaymentType.INSTALLMENT,
            Created_By=self.admin_user,
        )

        response = self.client.get("/api/inquiries/payment-approvals/")

        self.assertEqual(response.status_code, 200)
        payment = next(
            item for item in response.data if item["product_id"] == self.pending_payment.id
        )
        self.assertEqual(payment["total_paid"], "4.00")
        self.assertEqual(payment["remaining_balance"], "6.00")
        self.assertEqual(payment["payment_amount"], "4.00")
        self.assertEqual(payment["payment_type"], "installment")

    def test_payment_approval_lists_each_saved_installment_as_a_separate_row(self):
        """Fails if approval collapses multiple saved installments into one row."""
        first_payment = PaymentDetail.objects.create(
            Inquiry_Product=self.pending_payment,
            Amount=Decimal("4.00"),
            Payment_Type=PaymentDetail.PaymentType.INSTALLMENT,
            Created_By=self.admin_user,
        )
        second_payment = PaymentDetail.objects.create(
            Inquiry_Product=self.pending_payment,
            Amount=Decimal("1.00"),
            Payment_Type=PaymentDetail.PaymentType.INSTALLMENT,
            Created_By=self.admin_user,
        )

        response = self.client.get("/api/inquiries/payment-approvals/")

        payments = [
            item
            for item in response.data
            if item["product_id"] == self.pending_payment.id
        ]
        self.assertEqual({item["id"] for item in payments}, {first_payment.Id, second_payment.Id})
        self.assertEqual({item["payment_amount"] for item in payments}, {"4.00", "1.00"})
        self.assertTrue(all(item["total_paid"] == "5.00" for item in payments))

    def test_super_admin_cannot_record_a_payment_from_pending(self):
        """Fails if the approval role can bypass the Admin payment-entry flow."""
        self.client.force_authenticate(self.super_admin_user)

        response = self.client.post(
            f"/api/inquiries/payment-pending/{self.pending_payment.id}/paid/",
            {"amount": "4.00", "payment_type": "installment"},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_admin_cannot_mark_a_payment_as_received(self):
        """Fails if the read-only Admin role can update a payment."""
        detail = PaymentDetail.objects.create(
            Inquiry_Product=self.pending_payment,
            Amount=Decimal("10.00"),
            Payment_Type=PaymentDetail.PaymentType.FULL,
            Created_By=self.admin_user,
        )

        response = self.client.post(
            f"/api/inquiries/payment-approvals/{detail.Id}/received/"
        )

        self.assertEqual(response.status_code, 403)
        detail.refresh_from_db()
        self.assertEqual(detail.Approval_Status, "Pending")
        self.pending_payment.refresh_from_db()
        self.assertEqual(self.pending_payment.Payment_Status, "Pending")

    def test_super_admin_can_mark_a_pending_revenue_payment_as_received(self):
        """Fails if the payment approver cannot complete a valid transition."""
        detail = PaymentDetail.objects.create(
            Inquiry_Product=self.pending_payment,
            Amount=Decimal("10.00"),
            Payment_Type=PaymentDetail.PaymentType.FULL,
            Created_By=self.admin_user,
        )
        self.client.force_authenticate(self.super_admin_user)

        response = self.client.post(
            f"/api/inquiries/payment-approvals/{detail.Id}/received/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["approval_status"], "Received")
        detail.refresh_from_db()
        self.assertEqual(detail.Approval_Status, "Received")
        self.pending_payment.refresh_from_db()
        self.assertEqual(self.pending_payment.Payment_Status, "Received")

    def test_super_admin_cannot_mark_an_already_received_payment_again(self):
        """Fails if completed payments can be transitioned a second time."""
        detail = PaymentDetail.objects.create(
            Inquiry_Product=self.pending_payment,
            Amount=Decimal("10.00"),
            Payment_Type=PaymentDetail.PaymentType.FULL,
            Created_By=self.admin_user,
        )
        self.client.force_authenticate(self.super_admin_user)
        self.client.post(f"/api/inquiries/payment-approvals/{detail.Id}/received/")

        response = self.client.post(
            f"/api/inquiries/payment-approvals/{detail.Id}/received/"
        )

        self.assertEqual(response.status_code, 400)

    def test_super_admin_can_approve_one_installment_independently_of_another(self):
        """Fails if approving one transaction affects a sibling transaction's status."""
        first = PaymentDetail.objects.create(
            Inquiry_Product=self.pending_payment,
            Amount=Decimal("4.00"),
            Payment_Type=PaymentDetail.PaymentType.INSTALLMENT,
            Created_By=self.admin_user,
        )
        second = PaymentDetail.objects.create(
            Inquiry_Product=self.pending_payment,
            Amount=Decimal("6.00"),
            Payment_Type=PaymentDetail.PaymentType.INSTALLMENT,
            Created_By=self.admin_user,
        )
        self.client.force_authenticate(self.super_admin_user)

        response = self.client.post(
            f"/api/inquiries/payment-approvals/{first.Id}/received/"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["payment_status"], "Pending")
        second.refresh_from_db()
        self.assertEqual(second.Approval_Status, "Pending")
