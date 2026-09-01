from datetime import date, datetime
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.contrib.auth.models import User
from django.test import override_settings
from django.db import DatabaseError
from django.test import TestCase
from rest_framework.exceptions import PermissionDenied, ValidationError

from Customers.models import CustomerDetails
from Inquiry.models import InquiryDetails_tbl, InquiryTaskProgress, TaskStatus
from Inquiry.task_progress import (
    can_read_inquiry_task,
    can_update_inquiry_task,
    get_task_actor,
    save_inquiry_progress,
    start_inquiry_task,
)
from masters.models import StatusTypeMaster
from staff.models import StaffDetails


class InquiryTaskProgressServiceTests(TestCase):
    fixed_now = datetime(2026, 8, 27, 19, 15, tzinfo=ZoneInfo("UTC"))

    def setUp(self):
        self.assigned_user = User.objects.create_user(
            username="assigned", is_staff=True
        )
        self.other_user = User.objects.create_user(username="other")
        self.inactive_user = User.objects.create_user(username="inactive")
        self.admin_user = User.objects.create_user(username="admin")
        self.super_admin_user = User.objects.create_user(username="super-admin")
        self.superuser = User.objects.create_superuser(
            username="superuser", password="password"
        )
        self.assigned_resource = self.make_resource(
            self.assigned_user, "Assigned Resource"
        )
        self.other_resource = self.make_resource(self.other_user, "Other Resource")
        self.inactive_resource = self.make_resource(
            self.inactive_user, "Inactive Resource", active=False
        )
        self.admin_resource = self.make_resource(
            self.admin_user, "Admin Resource", role="Admin"
        )
        self.super_admin_resource = self.make_resource(
            self.super_admin_user, "Super Admin Resource", role="Super Admin"
        )
        self.customer = CustomerDetails.objects.create(
            customer_code="TASK-CUSTOMER",
            customer_name="Task Customer",
            created_by=self.assigned_user,
        )
        self.inquiry = self.make_inquiry(self.assigned_resource)
        self.other_inquiry = self.make_inquiry(self.assigned_resource)

    def make_resource(self, user, name, active=True, role="Staff"):
        return StaffDetails.objects.create(
            Full_Name=name,
            Designation="Consultant",
            Email_Address=f"{user.username}@example.com",
            Phone_Number="9999999999",
            Hire_Date=date(2026, 1, 1),
            Role=role,
            Is_Active=active,
            User_Id=user,
        )

    def make_inquiry(self, resource):
        return InquiryDetails_tbl.objects.create(
            Customer_Id=self.customer,
            Shedule_Date=date(2026, 8, 27),
            Resource_Id=resource,
            Created_Id=self.assigned_user,
        )

    def add_status(self, name):
        return StatusTypeMaster.objects.create(
            status_type_name=name,
            created_by=self.assigned_user,
        )

    def start(self, inquiry=None, user=None):
        with patch("Inquiry.task_progress.timezone.now", return_value=self.fixed_now):
            return start_inquiry_task(
                inquiry=inquiry or self.inquiry,
                user=user or self.assigned_user,
            )

    def save(self, inquiry=None, user=None, notes="Spoke with customer.", outcome=TaskStatus.PROGRESS_SAVED):
        with patch("Inquiry.task_progress.timezone.now", return_value=self.fixed_now):
            return save_inquiry_progress(
                inquiry=inquiry or self.inquiry,
                user=user or self.assigned_user,
                progress_notes=notes,
                outcome=outcome,
            )

    def test_assigned_active_resource_starts_task_with_kolkata_work_date(self):
        in_progress = self.add_status("in progress")

        progress = self.start()

        self.assertEqual(progress.Resource_Id_id, self.assigned_resource.pk)
        self.assertEqual(progress.Inquiry_Id_id, self.inquiry.pk)
        self.assertEqual(progress.Start_Time, datetime(2026, 8, 28, 0, 45))
        self.assertEqual(progress.Work_Date, date(2026, 8, 28))
        self.assertEqual(progress.Task_Status, TaskStatus.ACTIVE)
        self.inquiry.refresh_from_db()
        self.assertEqual(self.inquiry.Status_Id_id, in_progress.pk)

    @override_settings(TIME_ZONE="Asia/Kolkata", USE_TZ=False)
    def test_start_stores_the_ist_clock_time_without_utc_conversion(self):
        self.add_status("In Progress")

        progress = self.start()

        self.assertEqual(progress.Start_Time, datetime(2026, 8, 28, 0, 45))

    def test_task_actor_and_read_access_limit_staff_to_their_assigned_inquiry(self):
        self.assertEqual(get_task_actor(self.assigned_user), self.assigned_resource)
        self.assertIsNone(get_task_actor(self.inactive_user))
        self.assertTrue(can_read_inquiry_task(self.assigned_user, self.inquiry))
        self.assertTrue(can_update_inquiry_task(self.assigned_user, self.inquiry))
        self.assertFalse(can_read_inquiry_task(self.other_user, self.inquiry))
        self.assertFalse(can_update_inquiry_task(self.other_user, self.inquiry))
        self.assertTrue(can_read_inquiry_task(self.admin_user, self.inquiry))
        self.assertTrue(can_read_inquiry_task(self.super_admin_user, self.inquiry))
        self.assertTrue(can_read_inquiry_task(self.superuser, self.inquiry))
        self.assertFalse(can_update_inquiry_task(self.admin_user, self.inquiry))
        self.assertFalse(can_update_inquiry_task(self.super_admin_user, self.inquiry))
        self.assertFalse(can_update_inquiry_task(self.superuser, self.inquiry))

    def test_admin_and_superuser_cannot_start_or_save_tasks(self):
        self.add_status("In Progress")

        for user in (self.admin_user, self.super_admin_user, self.superuser):
            with self.subTest(user=user.username):
                with self.assertRaises(PermissionDenied):
                    self.start(user=user)

        self.assertEqual(InquiryTaskProgress.objects.count(), 0)
        self.start()
        for user in (self.admin_user, self.super_admin_user, self.superuser):
            with self.subTest(user=f"save-{user.username}"):
                with self.assertRaises(PermissionDenied):
                    self.save(user=user)

    def test_other_staff_cannot_start_or_save_an_assigned_task(self):
        self.add_status("In Progress")

        with self.assertRaises(PermissionDenied):
            self.start(user=self.other_user)
        self.start()
        with self.assertRaises(PermissionDenied):
            self.save(user=self.other_user)

    def test_inactive_staff_cannot_start_or_save_an_assigned_task(self):
        self.add_status("In Progress")

        with self.assertRaises(PermissionDenied):
            self.start(user=self.inactive_user)
        self.start()
        with self.assertRaises(PermissionDenied):
            self.save(user=self.inactive_user)

    def test_start_requires_in_progress_master_without_creating_a_task(self):
        with self.assertRaises(ValidationError) as error:
            self.start()

        self.assertEqual(error.exception.detail, ["Required inquiry status 'In Progress' is not configured."])
        self.assertEqual(InquiryTaskProgress.objects.count(), 0)
        self.inquiry.refresh_from_db()
        self.assertIsNone(self.inquiry.Status_Id)

    def test_start_rejects_second_active_task_for_resource_on_another_inquiry(self):
        self.add_status("In Progress")
        self.start()

        with self.assertRaises(ValidationError) as error:
            self.start(inquiry=self.other_inquiry)

        self.assertEqual(error.exception.detail, ["This resource already has an active task."])
        self.assertEqual(InquiryTaskProgress.objects.count(), 1)

    def test_save_rejects_blank_notes_without_ending_active_task(self):
        self.add_status("In Progress")
        progress = self.start()

        with self.assertRaises(ValidationError) as error:
            self.save(notes="   ")

        self.assertEqual(error.exception.detail, ["Progress notes are required."])
        progress.refresh_from_db()
        self.assertIsNone(progress.End_Time)
        self.assertEqual(progress.Task_Status, TaskStatus.ACTIVE)

    def test_save_rejects_invalid_outcome_without_ending_active_task(self):
        self.add_status("In Progress")
        progress = self.start()

        with self.assertRaises(ValidationError) as error:
            self.save(outcome=TaskStatus.ACTIVE)

        self.assertEqual(error.exception.detail, ["Invalid task outcome."])
        progress.refresh_from_db()
        self.assertIsNone(progress.End_Time)

    def test_save_requires_active_row_for_selected_inquiry(self):
        with self.assertRaises(ValidationError) as error:
            self.save()

        self.assertEqual(error.exception.detail, ["No active task found for this inquiry."])

    def test_save_records_trimmed_notes_and_progress_saved_outcome(self):
        self.add_status("In Progress")
        progress = self.start()

        saved = self.save(notes="  Progress is on track.  ")

        self.assertEqual(saved.pk, progress.pk)
        self.assertEqual(saved.End_Time, datetime(2026, 8, 28, 0, 45))
        self.assertEqual(saved.Progress_Notes, "Progress is on track.")
        self.assertEqual(saved.Task_Status, TaskStatus.PROGRESS_SAVED)
        self.inquiry.refresh_from_db()
        self.assertEqual(self.inquiry.Status_Id.status_type_name, "In Progress")

    def test_payment_pending_save_updates_progress_and_inquiry_status(self):
        self.add_status("In Progress")
        payment_pending = self.add_status("PAYMENT PENDING")
        self.start()

        saved = self.save(outcome=TaskStatus.PAYMENT_PENDING)

        self.assertEqual(saved.Task_Status, TaskStatus.PAYMENT_PENDING)
        self.assertEqual(saved.End_Time, datetime(2026, 8, 28, 0, 45))
        self.inquiry.refresh_from_db()
        self.assertEqual(self.inquiry.Status_Id_id, payment_pending.pk)

    def test_payment_pending_save_is_atomic_when_status_master_is_missing(self):
        self.add_status("In Progress")
        progress = self.start()

        with self.assertRaises(ValidationError) as error:
            self.save(outcome=TaskStatus.PAYMENT_PENDING)

        self.assertEqual(error.exception.detail, ["Required inquiry status 'Payment Pending' is not configured."])
        progress.refresh_from_db()
        self.assertIsNone(progress.End_Time)
        self.assertEqual(progress.Task_Status, TaskStatus.ACTIVE)

    def test_start_converts_resource_lock_database_errors_to_validation_errors(self):
        self.add_status("In Progress")

        with patch(
            "Inquiry.task_progress.StaffDetails.objects.select_for_update",
            side_effect=DatabaseError("lock timeout"),
        ):
            with self.assertRaises(ValidationError) as error:
                self.start()

        self.assertEqual(
            error.exception.detail,
            ["Unable to acquire the task resource lock. Please try again."],
        )
        self.assertEqual(InquiryTaskProgress.objects.count(), 0)

    def test_save_converts_resource_lock_database_errors_to_validation_errors(self):
        self.add_status("In Progress")
        progress = self.start()

        with patch(
            "Inquiry.task_progress.StaffDetails.objects.select_for_update",
            side_effect=DatabaseError("deadlock"),
        ):
            with self.assertRaises(ValidationError) as error:
                self.save()

        self.assertEqual(
            error.exception.detail,
            ["Unable to acquire the task resource lock. Please try again."],
        )
        progress.refresh_from_db()
        self.assertIsNone(progress.End_Time)
