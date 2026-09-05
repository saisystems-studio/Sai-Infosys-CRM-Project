from datetime import date, timedelta

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from Customers.models import CustomerDetails
from Inquiry.models import (
    InquiryDetails_tbl,
    InquiryProductDetails_tbl,
    InquiryTaskProgress,
    TaskStatus,
)
from masters.models import MenuMaster, StatusTypeMaster
from staff.models import StaffDetails, StaffMenuPermission


class InquiryTaskWriteApiTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="assigned")
        self.resource = StaffDetails.objects.create(
            Full_Name="Assigned Resource",
            Designation="Consultant",
            Email_Address="assigned@example.com",
            Phone_Number="9999999999",
            Hire_Date=date(2026, 1, 1),
            Role="Staff",
            Is_Active=True,
            User_Id=self.user,
        )
        menu = MenuMaster.objects.create(Menu_Name="Inquiry List")
        StaffMenuPermission.objects.create(
            Staff=self.resource,
            Menu=menu,
            Can_View=True,
            Can_Add=True,
        )
        customer = CustomerDetails.objects.create(
            customer_code="TASK-WRITE-CUSTOMER",
            customer_name="Task Write Customer",
            created_by=self.user,
        )
        self.inquiry = InquiryDetails_tbl.objects.create(
            Customer_Id=customer,
            Shedule_Date=date(2026, 8, 27),
            Resource_Id=self.resource,
            Created_Id=self.user,
        )
        StatusTypeMaster.objects.create(
            status_type_name="In Progress", created_by=self.user
        )

    def start_task_url(self):
        return f"/api/inquiries/{self.inquiry.pk}/start-task/"

    def remove_task_url(self):
        return f"/api/inquiries/{self.inquiry.pk}/remove-task/"

    def payment_pending_url(self):
        return f"/api/inquiries/{self.inquiry.pk}/move-to-payment-pending/"

    def invoice_amount_url(self):
        return f"/api/inquiries/{self.inquiry.pk}/invoice-amount/"

    def callback_reschedule_url(self):
        return f"/api/inquiries/{self.inquiry.pk}/reschedule-callback/"

    def test_assigned_resource_can_reschedule_reminder_while_another_task_is_active(self):
        original_callback = timezone.now() - timedelta(minutes=5)
        reminder_progress = InquiryTaskProgress.objects.create(
            Inquiry_Id=self.inquiry,
            Resource_Id=self.resource,
            Work_Date=original_callback.date(),
            Start_Time=original_callback - timedelta(minutes=10),
            End_Time=original_callback - timedelta(minutes=8),
            Reschedule_At=original_callback,
            Progress_Notes="Call rescheduled",
            Task_Status=TaskStatus.RESCHEDULED,
            Created_By=self.user,
        )
        other_inquiry = InquiryDetails_tbl.objects.create(
            Customer_Id=self.inquiry.Customer_Id,
            Shedule_Date=date.today(),
            Resource_Id=self.resource,
            Created_Id=self.user,
        )
        active_task = InquiryTaskProgress.objects.create(
            Inquiry_Id=other_inquiry,
            Resource_Id=self.resource,
            Work_Date=date.today(),
            Start_Time=timezone.now(),
            Task_Status=TaskStatus.ACTIVE,
            Created_By=self.user,
        )
        next_callback = timezone.now() + timedelta(hours=2)
        self.client.force_authenticate(self.user)

        response = self.client.post(
            self.callback_reschedule_url(),
            {"reschedule_at": next_callback.isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        reminder_progress.refresh_from_db()
        self.inquiry.refresh_from_db()
        active_task.refresh_from_db()
        self.assertEqual(reminder_progress.Reschedule_At, original_callback)
        new_reminder = self.inquiry.task_progress.exclude(
            pk=reminder_progress.pk
        ).get()
        self.assertEqual(new_reminder.Reschedule_At, next_callback)
        self.assertEqual(new_reminder.Progress_Notes, "Callback rescheduled from reminder")
        self.assertEqual(new_reminder.Task_Status, TaskStatus.RESCHEDULED)
        self.assertIsNotNone(new_reminder.End_Time)
        self.assertEqual(response.data["id"], new_reminder.pk)
        self.assertEqual(self.inquiry.Shedule_Date, next_callback.date())
        self.assertIsNone(active_task.End_Time)

    def test_callback_reschedule_accepts_today_when_time_is_still_in_the_future(self):
        original_callback = timezone.now() - timedelta(minutes=5)
        InquiryTaskProgress.objects.create(
            Inquiry_Id=self.inquiry,
            Resource_Id=self.resource,
            Work_Date=original_callback.date(),
            Start_Time=original_callback - timedelta(minutes=10),
            End_Time=original_callback - timedelta(minutes=8),
            Reschedule_At=original_callback,
            Progress_Notes="Call rescheduled",
            Task_Status=TaskStatus.RESCHEDULED,
            Created_By=self.user,
        )
        self.client.force_authenticate(self.user)
        future_today = timezone.now() + timedelta(minutes=10)

        response = self.client.post(
            self.callback_reschedule_url(),
            {"reschedule_at": future_today.isoformat()},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["reschedule_at"], future_today.isoformat())

    def test_callback_reschedule_rejects_a_past_time(self):
        self.client.force_authenticate(self.user)
        yesterday = timezone.now().date() - timedelta(days=1)

        response = self.client.post(
            self.callback_reschedule_url(),
            {"reschedule_at": f"{yesterday.isoformat()}T23:59:00+00:00"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("future", str(response.data["reschedule_at"][0]).lower())

    def test_assigned_resource_can_save_invoice_amount(self):
        product = InquiryProductDetails_tbl.objects.create(
            Inquiry_Id=self.inquiry,
            Quantity=1,
            Rate=100,
            Amount=100,
            Created_By=self.user,
        )
        self.client.force_authenticate(self.user)

        response = self.client.post(
            self.invoice_amount_url(),
            {"invoice_amount": "1250.50"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        product.refresh_from_db()
        self.assertEqual(str(product.Invoice_Amount), "1250.50")
        self.assertEqual(response.data["invoice_amount"], "1250.50")

    def test_assigned_resource_can_start_a_task(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(self.start_task_url(), {}, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["task_status"], TaskStatus.ACTIVE)
        self.assertEqual(response.data["resource_id"], self.resource.pk)
        self.assertEqual(InquiryTaskProgress.objects.count(), 1)

    def test_payment_pending_inquiry_cannot_start_another_task(self):
        payment_pending = StatusTypeMaster.objects.create(
            status_type_name="Payment Pending", created_by=self.user
        )
        self.inquiry.Status_Id = payment_pending
        self.inquiry.save(update_fields=["Status_Id"])
        self.client.force_authenticate(self.user)

        response = self.client.post(self.start_task_url(), {}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data[0],
            "This inquiry is already in Payment Pending. The task process is completed.",
        )
        self.assertFalse(
            InquiryTaskProgress.objects.filter(Inquiry_Id=self.inquiry).exists()
        )

    def test_assigned_resource_can_remove_only_the_current_active_task(self):
        active_task = InquiryTaskProgress.objects.create(
            Inquiry_Id=self.inquiry,
            Resource_Id=self.resource,
            Work_Date=date(2026, 8, 27),
            Start_Time="2026-08-27T10:00:00Z",
            Created_By=self.user,
        )
        self.client.force_authenticate(self.user)

        response = self.client.post(self.remove_task_url(), {}, format="json")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(InquiryTaskProgress.objects.filter(pk=active_task.pk).exists())

    def test_saved_task_can_move_the_inquiry_to_payment_pending(self):
        payment_pending = StatusTypeMaster.objects.create(
            status_type_name="Payment Pending", created_by=self.user
        )
        InquiryTaskProgress.objects.create(
            Inquiry_Id=self.inquiry,
            Resource_Id=self.resource,
            Work_Date=date(2026, 8, 27),
            Start_Time="2026-08-27T10:00:00Z",
            End_Time="2026-08-27T10:15:00Z",
            Progress_Notes="Customer requested the payment link.",
            Task_Status=TaskStatus.PROGRESS_SAVED,
            Created_By=self.user,
        )
        product = InquiryProductDetails_tbl.objects.create(
            Inquiry_Id=self.inquiry,
            Quantity=1,
            Rate=100,
            Amount=100,
            Created_By=self.user,
        )
        self.client.force_authenticate(self.user)

        response = self.client.post(
            self.payment_pending_url(),
            {"invoice_amount": "3000.00", "revenue_amount": "2500.00"},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.inquiry.refresh_from_db()
        product.refresh_from_db()
        self.assertEqual(self.inquiry.Status_Id_id, payment_pending.pk)
        self.assertEqual(str(product.Invoice_Amount), "3000.00")
        self.assertEqual(str(product.Amount), "100.00")
        self.assertEqual(str(product.Revenue_Amount), "2500.00")
        self.assertEqual(product.Payment_Status, "Pending")
        self.assertFalse(response.data["can_move_to_payment_pending"])

    def test_unpaid_service_completes_with_zero_amounts_without_payment_pending(self):
        InquiryTaskProgress.objects.create(
            Inquiry_Id=self.inquiry,
            Resource_Id=self.resource,
            Work_Date=date(2026, 8, 27),
            Start_Time="2026-08-27T10:00:00Z",
            End_Time="2026-08-27T10:15:00Z",
            Progress_Notes="Service completed without charge.",
            Task_Status=TaskStatus.PROGRESS_SAVED,
            Created_By=self.user,
        )
        product = InquiryProductDetails_tbl.objects.create(
            Inquiry_Id=self.inquiry,
            Quantity=1,
            Rate=100,
            Amount=100,
            Invoice_Amount=999,
            Revenue_Amount=888,
            Created_By=self.user,
        )
        self.client.force_authenticate(self.user)

        response = self.client.post(
            self.payment_pending_url(),
            {
                "invoice_amount": "3000.00",
                "revenue_amount": "2500.00",
                "unpaid_service": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.inquiry.refresh_from_db()
        product.refresh_from_db()
        self.assertEqual(self.inquiry.Status_Id.status_type_name, "Completed")
        self.assertEqual(
            StatusTypeMaster.objects.filter(status_type_name__iexact="Completed").count(),
            1,
        )
        self.assertEqual(str(product.Invoice_Amount), "0.00")
        self.assertEqual(str(product.Revenue_Amount), "0.00")
        self.assertEqual(product.Payment_Status, "Not Required")
        self.assertFalse(response.data["can_move_to_payment_pending"])
