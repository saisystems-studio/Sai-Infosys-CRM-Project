from zoneinfo import ZoneInfo

from django.db import DatabaseError, IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from masters.models import StatusTypeMaster
from staff.access import get_staff, has_full_access
from staff.models import StaffDetails

from .models import InquiryTaskProgress, TaskStatus


IN_PROGRESS_STATUS_NAME = "In Progress"
PAYMENT_PENDING_STATUS_NAME = "Payment Pending"
COMPLETED_STATUS_NAME = "Completed"
IST = ZoneInfo("Asia/Kolkata")


def _local_timestamp():
    """Return the current India time as a value stored without UTC conversion."""
    now = timezone.now()
    if timezone.is_naive(now):
        return now
    return now.astimezone(IST).replace(tzinfo=None)


def get_task_actor(user):
    """Return the user's active staff record, when one exists."""
    staff = get_staff(user)
    return staff if staff and staff.Is_Active else None


def can_read_inquiry_task(user, inquiry):
    staff = get_staff(user)
    if has_full_access(user, staff):
        return True

    return bool(staff and staff.Is_Active and inquiry.Resource_Id_id == staff.pk)


def can_update_inquiry_task(user, inquiry):
    staff = get_staff(user)
    return bool(staff and staff.Is_Active and inquiry.Resource_Id_id == staff.pk)


def _require_writable_actor(user, inquiry, *, lock=False):
    actor = get_staff(user)
    if not actor or not actor.Is_Active or inquiry.Resource_Id_id != actor.pk:
        raise PermissionDenied("Only the assigned active resource can update this inquiry task.")

    if not lock:
        return actor

    try:
        with transaction.atomic():
            actor = (
                StaffDetails.objects.select_for_update()
                .filter(pk=actor.pk, User_Id=user, Is_Active=True)
                .first()
            )
    except DatabaseError as error:
        raise ValidationError(
            "Unable to acquire the task resource lock. Please try again."
        ) from error

    if not actor or inquiry.Resource_Id_id != actor.pk:
        raise PermissionDenied("Only the assigned active resource can update this inquiry task.")

    return actor


def _required_status(name):
    status = StatusTypeMaster.objects.filter(status_type_name__iexact=name).first()
    if not status:
        raise ValidationError(f"Required inquiry status '{name}' is not configured.")
    return status


def _completed_status(user):
    status = StatusTypeMaster.objects.filter(
        status_type_name__iexact=COMPLETED_STATUS_NAME
    ).first()
    if status:
        return status
    return StatusTypeMaster.objects.create(
        status_type_name=COMPLETED_STATUS_NAME,
        created_by=user,
    )


@transaction.atomic
def save_invoice_amount(*, inquiry, user, invoice_amount):
    """Persist the invoice amount for the inquiry's primary product row."""
    _require_writable_actor(user, inquiry, lock=True)
    product = (
        inquiry.inquiryproductdetails_tbl_set
        .select_for_update()
        .order_by("pk")
        .first()
    )
    if not product:
        raise ValidationError("This inquiry has no product details.")

    product.Invoice_Amount = invoice_amount
    product.save(update_fields=["Invoice_Amount"])
    return product


@transaction.atomic
def reschedule_callback(*, inquiry, user, reschedule_at):
    """Record a new callback without changing any active task session."""
    resource = _require_writable_actor(user, inquiry, lock=True)
    if (
        inquiry.Status_Id
        and inquiry.Status_Id.status_type_name.strip().lower()
        == PAYMENT_PENDING_STATUS_NAME.lower()
    ):
        raise ValidationError("Payment Pending inquiries cannot be rescheduled.")

    previous_progress = (
        inquiry.task_progress.select_for_update()
        .filter(
            Task_Status=TaskStatus.RESCHEDULED,
            End_Time__isnull=False,
        )
        .order_by("-Start_Time")
        .first()
    )
    if not previous_progress:
        raise ValidationError("No rescheduled callback was found for this inquiry.")

    now = _local_timestamp()
    progress = InquiryTaskProgress.objects.create(
        Inquiry_Id=inquiry,
        Resource_Id=resource,
        Work_Date=now.date(),
        Start_Time=now,
        End_Time=now,
        Reschedule_At=reschedule_at,
        Progress_Notes="Callback rescheduled from reminder",
        Task_Status=TaskStatus.RESCHEDULED,
        Created_By=user,
    )
    inquiry.Shedule_Date = reschedule_at.date()
    inquiry.save(update_fields=["Shedule_Date"])
    return progress


@transaction.atomic
def start_inquiry_task(*, inquiry, user):
    """Start the assigned resource's task, provided they have no active task."""
    resource = _require_writable_actor(user, inquiry, lock=True)

    if (
        inquiry.Status_Id
        and inquiry.Status_Id.status_type_name.strip().lower()
        == PAYMENT_PENDING_STATUS_NAME.lower()
    ):
        raise ValidationError(
            "This inquiry is already in Payment Pending. The task process is completed."
        )

    if InquiryTaskProgress.objects.filter(
        Resource_Id=resource,
        End_Time__isnull=True,
    ).exists():
        raise ValidationError("This resource already has an active task.")

    in_progress_status = _required_status(IN_PROGRESS_STATUS_NAME)
    now = _local_timestamp()

    try:
        with transaction.atomic():
            progress = InquiryTaskProgress.objects.create(
                Inquiry_Id=inquiry,
                Resource_Id=resource,
                Work_Date=now.date(),
                Start_Time=now,
                Task_Status=TaskStatus.ACTIVE,
                Created_By=user,
            )
    except IntegrityError as error:
        raise ValidationError("This resource already has an active task.") from error
    except DatabaseError as error:
        raise ValidationError("Unable to start the inquiry task. Please try again.") from error

    inquiry.Status_Id = in_progress_status
    inquiry.save(update_fields=["Status_Id"])
    return progress


@transaction.atomic
def save_inquiry_progress(*, inquiry, user, progress_notes, outcome, reschedule_at=None):
    """Close the assigned resource's active task and record its outcome."""
    notes = (progress_notes or "").strip()
    if outcome == TaskStatus.RESCHEDULED and not notes:
        notes = "Call rescheduled"
    if not notes:
        raise ValidationError("Progress notes are required.")

    if outcome not in {
        TaskStatus.PROGRESS_SAVED,
        TaskStatus.PAYMENT_PENDING,
        TaskStatus.RESCHEDULED,
    }:
        raise ValidationError("Invalid task outcome.")
    if outcome == TaskStatus.RESCHEDULED and not reschedule_at:
        raise ValidationError("Choose a callback date and time to reschedule this task.")

    resource = _require_writable_actor(user, inquiry, lock=True)
    payment_pending_status = None
    if outcome == TaskStatus.PAYMENT_PENDING:
        payment_pending_status = _required_status(PAYMENT_PENDING_STATUS_NAME)

    try:
        with transaction.atomic():
            progress = (
                InquiryTaskProgress.objects.select_for_update()
                .filter(
                    Inquiry_Id=inquiry,
                    Resource_Id=resource,
                    End_Time__isnull=True,
                )
                .first()
            )
    except DatabaseError as error:
        raise ValidationError("Unable to save task progress. Please try again.") from error

    if not progress:
        raise ValidationError("No active task found for this inquiry.")

    progress.End_Time = _local_timestamp()
    progress.Progress_Notes = notes
    progress.Task_Status = outcome
    progress.Reschedule_At = reschedule_at if outcome == TaskStatus.RESCHEDULED else None
    progress.save(update_fields=[
        "End_Time", "Progress_Notes", "Task_Status", "Reschedule_At", "Updated_On"
    ])

    if outcome == TaskStatus.RESCHEDULED:
        inquiry.Shedule_Date = reschedule_at.date()
        inquiry.save(update_fields=["Shedule_Date"])

    if payment_pending_status:
        inquiry.Status_Id = payment_pending_status
        inquiry.save(update_fields=["Status_Id"])

    return progress


@transaction.atomic
def remove_active_inquiry_task(*, inquiry, user):
    """Delete the assigned resource's active task for this inquiry only."""
    resource = _require_writable_actor(user, inquiry, lock=True)
    progress = (
        InquiryTaskProgress.objects.select_for_update()
        .filter(
            Inquiry_Id=inquiry,
            Resource_Id=resource,
            End_Time__isnull=True,
        )
        .first()
    )
    if not progress:
        raise ValidationError("No active task found for this inquiry.")

    progress.delete()


@transaction.atomic
def move_inquiry_to_payment_pending(
    *, inquiry, user, invoice_amount=None, revenue_amount=0, unpaid_service=False
):
    """Finish a saved task as payment pending or as an unpaid service."""
    resource = _require_writable_actor(user, inquiry, lock=True)
    has_saved_task = InquiryTaskProgress.objects.filter(
        Inquiry_Id=inquiry,
        Resource_Id=resource,
        End_Time__isnull=False,
        Task_Status=TaskStatus.PROGRESS_SAVED,
    ).exists()
    if not has_saved_task:
        raise ValidationError("Save task progress before moving to Payment Pending.")

    product = (
        inquiry.inquiryproductdetails_tbl_set
        .select_for_update()
        .order_by("pk")
        .first()
    )
    if product:
        update_fields = ["Revenue_Amount", "Payment_Status"]
        if unpaid_service:
            product.Invoice_Amount = 0
            product.Revenue_Amount = 0
            product.Payment_Status = "Not Required"
            update_fields.append("Invoice_Amount")
        elif invoice_amount is not None:
            product.Invoice_Amount = invoice_amount
            update_fields.append("Invoice_Amount")
        if not unpaid_service:
            product.Revenue_Amount = revenue_amount
            product.Payment_Status = "Pending"
        product.save(update_fields=update_fields)

    inquiry.Status_Id = (
        _completed_status(user)
        if unpaid_service
        else _required_status(PAYMENT_PENDING_STATUS_NAME)
    )
    inquiry.save(update_fields=["Status_Id"])
    return inquiry
