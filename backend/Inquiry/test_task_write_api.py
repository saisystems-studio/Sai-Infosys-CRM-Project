from datetime import date

from django.contrib.auth.models import User
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

    def test_assigned_resource_can_start_a_task(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(self.start_task_url(), {}, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["task_status"], TaskStatus.ACTIVE)
        self.assertEqual(response.data["resource_id"], self.resource.pk)
        self.assertEqual(InquiryTaskProgress.objects.count(), 1)

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
        self.assertEqual(str(product.Amount), "3000.00")
        self.assertEqual(str(product.Revenue_Amount), "2500.00")
        self.assertEqual(product.Payment_Status, "Pending")
