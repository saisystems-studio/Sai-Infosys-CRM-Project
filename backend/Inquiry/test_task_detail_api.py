from datetime import date, datetime
from decimal import Decimal

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from Customers.models import CustomerDetails
from Inquiry.models import (
    InquiryDetails_tbl,
    InquiryProductDetails_tbl,
    InquiryTaskProgress,
    PaymentDetail,
    TaskStatus,
)
from masters.models import MenuMaster, ProductTypeMaster
from staff.models import StaffDetails, StaffMenuPermission


class InquiryTaskDetailApiTests(APITestCase):
    def setUp(self):
        self.assigned_user = User.objects.create_user(username="assigned")
        self.other_user = User.objects.create_user(username="other")
        self.admin_user = User.objects.create_user(username="admin")
        self.assigned_resource = self.make_resource(
            self.assigned_user, "Assigned Resource"
        )
        self.other_resource = self.make_resource(self.other_user, "Other Resource")
        self.make_resource(self.admin_user, "Admin Resource", role="Admin")
        self.grant_inquiry_view(self.assigned_resource)
        self.grant_inquiry_view(self.other_resource)
        self.customer = CustomerDetails.objects.create(
            customer_code="TASK-DETAIL-CUSTOMER",
            customer_name="Task Detail Customer",
            email_id="customer@example.com",
            created_by=self.assigned_user,
        )
        self.inquiry = InquiryDetails_tbl.objects.create(
            Customer_Id=self.customer,
            Shedule_Date=date(2026, 8, 27),
            Resource_Id=self.assigned_resource,
            Created_Id=self.assigned_user,
        )
        self.older = self.make_progress(
            start_at=datetime(2026, 8, 27, 9, 0),
            end_at=datetime(2026, 8, 27, 10, 0),
            notes="Initial visit completed.",
            status=TaskStatus.PROGRESS_SAVED,
        )
        self.newer = self.make_progress(
            start_at=datetime(2026, 8, 27, 11, 0),
            end_at=datetime(2026, 8, 27, 12, 0),
            notes="Follow-up completed.",
            status=TaskStatus.PAYMENT_PENDING,
        )
        self.active = self.make_progress(
            start_at=datetime(2026, 8, 27, 13, 0),
            notes="Current task.",
            status=TaskStatus.ACTIVE,
        )

    def make_resource(self, user, name, role="Staff"):
        return StaffDetails.objects.create(
            Full_Name=name,
            Designation="Consultant",
            Email_Address=f"{user.username}@example.com",
            Phone_Number="9999999999",
            Hire_Date=date(2026, 1, 1),
            Role=role,
            Is_Active=True,
            User_Id=user,
        )

    def grant_inquiry_view(self, staff):
        menu, _ = MenuMaster.objects.get_or_create(Menu_Name="Inquiry List")
        StaffMenuPermission.objects.create(
            Staff=staff,
            Menu=menu,
            Can_View=True,
        )

    def make_progress(self, *, start_at, notes, status, end_at=None):
        return InquiryTaskProgress.objects.create(
            Inquiry_Id=self.inquiry,
            Resource_Id=self.assigned_resource,
            Work_Date=date(2026, 8, 27),
            Start_Time=timezone.make_aware(start_at),
            End_Time=timezone.make_aware(end_at) if end_at else None,
            Progress_Notes=notes,
            Task_Status=status,
            Created_By=self.assigned_user,
        )

    def task_detail_url(self):
        return f"/api/inquiries/{self.inquiry.pk}/task-detail/"

    def test_admin_reads_complete_history_but_cannot_update_task(self):
        self.client.force_authenticate(self.admin_user)

        response = self.client.get(self.task_detail_url())

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["can_update_task"])
        self.assertEqual(response.data["id"], self.inquiry.pk)
        self.assertEqual(response.data["customer_name"], "Task Detail Customer")
        self.assertEqual(response.data["resource_name"], "Assigned Resource")
        self.assertEqual(
            [row["id"] for row in response.data["task_progress"]],
            [self.active.pk, self.newer.pk, self.older.pk],
        )
        self.assertEqual(
            set(response.data["task_progress"][0]),
            {
                "id",
                "work_date",
                "start_time",
                "end_time",
                "progress_notes",
                "task_status",
                "task_status_label",
                "resource_id",
                "resource_name",
                "reschedule_at",
            },
        )
        self.assertEqual(response.data["task_progress"][0]["task_status"], "active")
        self.assertEqual(response.data["task_progress"][0]["task_status_label"], "Active")

    def test_admin_can_update_own_assigned_task(self):
        admin_resource = self.admin_user.staff_details
        self.inquiry.Resource_Id = admin_resource
        self.inquiry.save(update_fields=["Resource_Id"])

        self.client.force_authenticate(self.admin_user)

        response = self.client.get(self.task_detail_url())

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["can_update_task"])

    def test_assigned_resource_can_read_and_receives_active_session(self):
        self.client.force_authenticate(self.assigned_user)

        response = self.client.get(self.task_detail_url())

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["can_update_task"])
        self.assertEqual(response.data["active_session"]["id"], self.active.pk)
        self.assertIsNone(response.data["active_session"]["end_time"])
        self.assertEqual(
            response.data["active_session"]["resource_id"], self.assigned_resource.pk
        )

    def test_other_staff_cannot_read_an_unassigned_inquiry(self):
        self.client.force_authenticate(self.other_user)

        response = self.client.get(self.task_detail_url())

        self.assertEqual(response.status_code, 403)

    def test_empty_history_returns_no_active_session(self):
        InquiryTaskProgress.objects.all().delete()
        self.client.force_authenticate(self.assigned_user)

        response = self.client.get(self.task_detail_url())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["task_progress"], [])
        self.assertIsNone(response.data["active_session"])

    def test_task_detail_includes_payment_summary_and_transactions(self):
        product_type = ProductTypeMaster.objects.create(
            product_type_name="CRM Service",
            created_by=self.assigned_user,
        )
        product = InquiryProductDetails_tbl.objects.create(
            Inquiry_Id=self.inquiry,
            ProductType_Id=product_type,
            Quantity=1,
            Rate=Decimal("150.00"),
            Amount=Decimal("150.00"),
            Revenue_Amount=Decimal("150.00"),
            Created_By=self.assigned_user,
        )
        payment = PaymentDetail.objects.create(
            Inquiry_Product=product,
            Amount=Decimal("50.00"),
            Payment_Type=PaymentDetail.PaymentType.INSTALLMENT,
            Approval_Status=PaymentDetail.PaymentApprovalStatus.RECEIVED,
            Created_By=self.assigned_user,
        )
        self.client.force_authenticate(self.assigned_user)

        response = self.client.get(self.task_detail_url())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data["payment_summary"]["total_amount"],
            Decimal("150.00"),
        )
        self.assertEqual(
            response.data["payment_summary"]["total_paid"],
            Decimal("50.00"),
        )
        self.assertEqual(
            response.data["payment_summary"]["remaining_amount"],
            Decimal("100.00"),
        )
        self.assertEqual(response.data["payment_summary"]["status"], "Not Paid")
        self.assertEqual(
            response.data["payment_summary"]["payments"][0]["id"],
            payment.Id,
        )

    def test_schedule_returns_completed_duration_and_active_start_time(self):
        self.client.force_authenticate(self.assigned_user)

        response = self.client.get("/api/inquiries/schedule/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]["completed_task_duration_seconds"], 7200)
        self.assertEqual(
            response.data[0]["active_task_started_at"],
            "2026-08-27T13:00:00",
        )

    def test_django_staff_flag_does_not_grant_all_schedule_access(self):
        self.assigned_user.is_staff = True
        self.assigned_user.save(update_fields=["is_staff"])
        other_inquiry = InquiryDetails_tbl.objects.create(
            Customer_Id=self.customer,
            Shedule_Date=date(2026, 8, 28),
            Resource_Id=self.other_resource,
            Created_Id=self.other_user,
        )
        self.client.force_authenticate(self.assigned_user)

        response = self.client.get("/api/inquiries/schedule/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["id"] for row in response.data], [self.inquiry.pk])
        self.assertNotIn(other_inquiry.pk, [row["id"] for row in response.data])

    def test_crm_admin_role_can_view_all_staff_schedules(self):
        other_inquiry = InquiryDetails_tbl.objects.create(
            Customer_Id=self.customer,
            Shedule_Date=date(2026, 8, 28),
            Resource_Id=self.other_resource,
            Created_Id=self.other_user,
        )
        self.client.force_authenticate(self.admin_user)

        response = self.client.get("/api/inquiries/schedule/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {row["id"] for row in response.data},
            {self.inquiry.pk, other_inquiry.pk},
        )
