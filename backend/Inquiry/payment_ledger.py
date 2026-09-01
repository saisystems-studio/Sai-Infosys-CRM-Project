from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.http import Http404
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import InquiryProductDetails_tbl, PaymentDetail


def get_payment_balance(product):
    total_paid = product.payment_details.aggregate(total=Sum("Amount"))["total"] or Decimal("0.00")
    return total_paid, product.Revenue_Amount - total_paid


@transaction.atomic
def record_payment(*, product_id, user, amount, payment_type):
    try:
        product = InquiryProductDetails_tbl.objects.select_for_update().get(
            pk=product_id,
            Revenue_Amount__gt=0,
            Payment_Status="Pending",
        )
    except InquiryProductDetails_tbl.DoesNotExist as error:
        raise Http404("Outstanding payment record not found.") from error

    total_paid, remaining_balance = get_payment_balance(product)

    if payment_type not in PaymentDetail.PaymentType.values:
        raise ValidationError({"payment_type": "Choose Full Payment or Installment."})
    if amount <= Decimal("0.00"):
        raise ValidationError({"amount": "Payment amount must be greater than zero."})
    if amount > remaining_balance:
        raise ValidationError({"amount": "Payment amount cannot exceed the remaining balance."})
    if payment_type == PaymentDetail.PaymentType.FULL and amount != remaining_balance:
        raise ValidationError({"amount": "Full Payment must equal the remaining balance."})

    PaymentDetail.objects.create(
        Inquiry_Product=product,
        Amount=amount,
        Payment_Type=payment_type,
        Created_By=user,
    )
    total_paid += amount
    remaining_balance = product.Revenue_Amount - total_paid

    return product, total_paid, remaining_balance


@transaction.atomic
def refresh_product_payment_status(product):
    product = InquiryProductDetails_tbl.objects.select_for_update().get(pk=product.pk)
    total_paid = product.payment_details.aggregate(total=Sum("Amount"))["total"] or Decimal("0.00")
    total_paid = total_paid.quantize(Decimal("0.01"))
    revenue_amount = (product.Revenue_Amount or Decimal("0.00")).quantize(
        Decimal("0.01")
    )
    has_pending_approval = product.payment_details.filter(
        Approval_Status=PaymentDetail.PaymentApprovalStatus.PENDING
    ).exists()

    if total_paid == revenue_amount and not has_pending_approval:
        product.Payment_Status = "Received"
    else:
        product.Payment_Status = "Pending"
    product.save(update_fields=["Payment_Status"])
    return product


@transaction.atomic
def approve_payment_detail(*, payment_detail_id, user):
    try:
        detail = PaymentDetail.objects.select_for_update().select_related(
            "Inquiry_Product"
        ).get(pk=payment_detail_id)
    except PaymentDetail.DoesNotExist as error:
        raise Http404("Payment transaction not found.") from error
    if detail.Approval_Status == PaymentDetail.PaymentApprovalStatus.RECEIVED:
        raise ValidationError({"detail": "Payment has already been received."})

    detail.Approval_Status = PaymentDetail.PaymentApprovalStatus.RECEIVED
    detail.Approved_By = user
    detail.Approved_On = timezone.now()
    detail.save(update_fields=["Approval_Status", "Approved_By", "Approved_On"])
    refresh_product_payment_status(detail.Inquiry_Product)
    return detail
