from datetime import date, datetime

from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APITestCase

from Customers.models import CustomerDetails
from Inquiry.models import InquiryDetails_tbl, InquiryTaskProgress, TaskStatus
from masters.models import MenuMaster, StatusTypeMaster
from staff.models import StaffDetails, StaffMenuPermission


class CompletedInquiryReportApiTests(APITestCase):
    def setUp(self):
        self.super_user = User.objects.create_user(username="report-super")
        self.staff_user = User.objects.create_user(username="report-staff")
        self.other_user = User.objects.create_user(username="report-other")
        self.super_staff = self.make_staff(self.super_user, "Report Super", "Super Admin")
        self.staff = self.make_staff(self.staff_user, "Report Staff", "Staff")
        self.other_staff = self.make_staff(self.other_user, "Other Staff", "Staff")
        self.report_menu = MenuMaster.objects.create(
            Menu_Name="Completed Inquery Report", Is_Active=True
        )
        for staff in (self.staff, self.other_staff):
            StaffMenuPermission.objects.create(
                Staff=staff, Menu=self.report_menu, Can_View=True
            )
        self.completed = StatusTypeMaster.objects.create(
            status_type_name="Completed", created_by=self.super_user
        )
        self.in_progress = StatusTypeMaster.objects.create(
            status_type_name="In Progress", created_by=self.super_user
        )
        self.customer = CustomerDetails.objects.create(
            customer_code="REPORT-CUSTOMER",
            customer_name="Report Customer",
            email_id="report@example.com",
            created_by=self.super_user,
        )
        self.own_completed = self.make_inquiry(self.staff, self.completed)
        self.other_completed = self.make_inquiry(self.other_staff, self.completed)
        self.own_in_progress = self.make_inquiry(self.staff, self.in_progress)
        InquiryTaskProgress.objects.create(
            Inquiry_Id=self.own_completed,
            Resource_Id=self.staff,
            Work_Date=date(2026, 8, 31),
            Start_Time=timezone.make_aware(datetime(2026, 8, 31, 9, 0)),
            End_Time=timezone.make_aware(datetime(2026, 8, 31, 10, 0)),
            Progress_Notes="Installed and verified the requested service.",
            Task_Status=TaskStatus.PROGRESS_SAVED,
            Created_By=self.staff_user,
        )

    def make_staff(self, user, name, role):
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

    def make_inquiry(self, resource, status):
        return InquiryDetails_tbl.objects.create(
            Customer_Id=self.customer,
            Shedule_Date=date(2026, 8, 31),
            Resource_Id=resource,
            Status_Id=status,
            Created_Id=self.super_user,
        )

    def test_staff_sees_only_own_completed_inquiries_with_task_details(self):
        self.client.force_authenticate(self.staff_user)

        response = self.client.get("/api/inquiries/completed-inquiry-report/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["id"] for row in response.data], [self.own_completed.pk])
        self.assertEqual(response.data[0]["task_progress"][0]["resource_name"], "Report Staff")
        self.assertEqual(
            response.data[0]["task_progress"][0]["progress_notes"],
            "Installed and verified the requested service.",
        )

    def test_super_admin_sees_every_staff_completed_inquiry(self):
        self.client.force_authenticate(self.super_user)

        response = self.client.get("/api/inquiries/completed-inquiry-report/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            {row["id"] for row in response.data},
            {self.own_completed.pk, self.other_completed.pk},
        )

    def test_staff_without_report_permission_is_denied(self):
        StaffMenuPermission.objects.filter(Staff=self.staff).delete()
        self.client.force_authenticate(self.staff_user)

        response = self.client.get("/api/inquiries/completed-inquiry-report/")

        self.assertEqual(response.status_code, 403)
