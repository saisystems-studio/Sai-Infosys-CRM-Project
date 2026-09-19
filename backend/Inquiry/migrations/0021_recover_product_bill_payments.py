from decimal import Decimal

from django.db import migrations
from django.db.models import Sum


def recover_payments(apps, schema_editor):
    Bill = apps.get_model("Inquiry", "ProductBilling")
    Payment = apps.get_model("Inquiry", "PaymentDetail")
    alias = schema_editor.connection.alias
    for bill in Bill.objects.using(alias).filter(Total_Paid__gt=0).iterator():
        recorded = Payment.objects.using(alias).filter(Product_Billing_id=bill.pk).aggregate(
            total=Sum("Amount")
        )["total"] or Decimal("0.00")
        missing = bill.Total_Paid - recorded
        if missing <= 0:
            continue
        payment = Payment.objects.using(alias).create(
            Product_Billing_id=bill.pk,
            Amount=missing,
            Payment_Type="full" if missing == bill.Amount + bill.GST else "installment",
            Created_By_id=bill.Created_By_id,
            Approval_Status="Pending",
        )
        # The previous implementation only stored a cumulative balance.
        # Leave the unknown payment date empty rather than inventing one.
        Payment.objects.using(alias).filter(pk=payment.pk).update(Payment_Date=None)
        Bill.objects.using(alias).filter(pk=bill.pk).update(Payment_Status="Pending")


class Migration(migrations.Migration):
    dependencies = [("Inquiry", "0020_payment_detail_product_billing")]
    operations = [migrations.RunPython(recover_payments, migrations.RunPython.noop)]
