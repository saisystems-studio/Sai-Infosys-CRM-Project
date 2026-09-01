from datetime import date

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from Customers.models import CustomerDetails
from Inquiry.models import InquiryDetails_tbl, InquiryTaskProgress, TaskStatus
from staff.models import StaffDetails


class InquiryTaskProgressModelTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="task-progress-user")
        self.resource = StaffDetails.objects.create(
            Full_Name="Priya",
            Designation="Consultant",
            Email_Address="priya@example.com",
            Phone_Number="9999999999",
            Hire_Date=date(2026, 1, 1),
            Role="Staff",
            User_Id=self.user,
        )
        customer = CustomerDetails.objects.create(
            customer_code="CUST-001",
            customer_name="Acme Corp",
            created_by=self.user,
        )
        self.first_inquiry = InquiryDetails_tbl.objects.create(
            Customer_Id=customer,
            Shedule_Date=date(2026, 8, 27),
        )
        self.second_inquiry = InquiryDetails_tbl.objects.create(
            Customer_Id=customer,
            Shedule_Date=date(2026, 8, 28),
        )

    def create_progress(self, inquiry, **overrides):
        defaults = {
            "Inquiry_Id": inquiry,
            "Resource_Id": self.resource,
            "Work_Date": date(2026, 8, 27),
            "Start_Time": timezone.now(),
            "Created_By": self.user,
        }
        defaults.update(overrides)
        return InquiryTaskProgress.objects.create(**defaults)

    def test_resource_cannot_own_two_active_sessions_across_inquiries(self):
        self.create_progress(self.first_inquiry)

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                self.create_progress(self.second_inquiry)

    def test_resource_can_own_multiple_completed_sessions_on_the_same_day(self):
        completed_at = timezone.now()
        first_session = self.create_progress(
            self.first_inquiry,
            End_Time=completed_at,
            Task_Status=TaskStatus.PROGRESS_SAVED,
        )
        second_session = self.create_progress(
            self.second_inquiry,
            End_Time=completed_at,
            Task_Status=TaskStatus.PAYMENT_PENDING,
        )

        self.assertEqual(
            InquiryTaskProgress.objects.filter(
                Resource_Id=self.resource,
                Work_Date=date(2026, 8, 27),
                End_Time__isnull=False,
            ).count(),
            2,
        )
        self.assertEqual(first_session.Task_Status, TaskStatus.PROGRESS_SAVED)
        self.assertEqual(second_session.Task_Status, TaskStatus.PAYMENT_PENDING)
