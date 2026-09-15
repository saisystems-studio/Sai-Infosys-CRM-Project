from datetime import date, datetime

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from Customers.models import CustomerDetails
from Inquiry.models import InquiryDetails_tbl, InquiryProductDetails_tbl, InquiryTaskProgress, TaskStatus
from masters.models import ProductTypeMaster, StatusTypeMaster
from staff.models import StaffDetails


class StaffDailyTaskReportTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.super_user = User.objects.create_user(username="daily-report-super")
        self.staff_user = User.objects.create_user(username="daily-report-staff")
        self.super_staff = self.make_staff(self.super_user, "Report Super", "Super Admin")
        self.staff = self.make_staff(self.staff_user, "Task Staff", "Staff")
        self.customer = CustomerDetails.objects.create(
            customer_code="TASK-001",
            customer_name="Task Customer",
            company_name="Task Company",
            created_by=self.super_user,
        )
        status = StatusTypeMaster.objects.create(
            status_type_name="In Progress", created_by=self.super_user
        )
        inquiry = InquiryDetails_tbl.objects.create(
            Customer_Id=self.customer,
            Resource_Id=self.staff,
            Status_Id=status,
            Shedule_Date=date(2026, 9, 10),
            Created_Id=self.super_user,
        )
        InquiryTaskProgress.objects.create(
            Inquiry_Id=inquiry,
            Resource_Id=self.staff,
            Work_Date=date(2026, 9, 10),
            Start_Time=timezone.make_aware(datetime(2026, 9, 10, 9, 0)),
            End_Time=timezone.make_aware(datetime(2026, 9, 10, 10, 30)),
            Progress_Notes="Customer visit completed",
            Task_Status=TaskStatus.PROGRESS_SAVED,
            Created_By=self.staff_user,
        )
        product = ProductTypeMaster.objects.create(
            product_type_name="CCTV", created_by=self.super_user
        )
        InquiryProductDetails_tbl.objects.create(
            Inquiry_Id=inquiry,
            ProductType_Id=product,
            Quantity=1,
            Rate=1000,
            Amount=1000,
            Created_By=self.super_user,
        )
        self.client = APIClient()

    def make_staff(self, user, name, role):
        return StaffDetails.objects.create(
            Full_Name=name,
            Designation="Consultant",
            Email_Address=f"{user.username}@example.com",
            Phone_Number="9999999999",
            Hire_Date=date(2026, 1, 1),
            Role=role,
            User_Id=user,
            Created_By=user,
        )

    def test_super_admin_receives_daily_task_rows_and_summary(self):
        self.client.force_authenticate(self.super_user)

        response = self.client.get("/api/staff-daily-task-report/?date=2026-09-10")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["summary"], {
            "total": 1, "completed": 1, "active": 0,
            "total_amount": 1000, "revenue_amount": 0,
        })
        self.assertEqual(response.data["tasks"][0]["resource_name"], "Task Staff")
        self.assertEqual(response.data["tasks"][0]["company_name"], "Task Company")
        self.assertEqual(response.data["tasks"][0]["products"], ["CCTV"])
        self.assertEqual(response.data["tasks"][0]["progress_notes"], "Customer visit completed")

    def test_non_super_admin_is_denied(self):
        self.client.force_authenticate(self.staff_user)

        response = self.client.get("/api/staff-daily-task-report/?date=2026-09-10")

        self.assertEqual(response.status_code, 403)
