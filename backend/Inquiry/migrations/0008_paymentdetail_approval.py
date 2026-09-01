from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def set_historical_payment_approval_statuses(apps, schema_editor):
    PaymentDetail = apps.get_model("Inquiry", "PaymentDetail")
    PaymentDetail.objects.filter(
        Inquiry_Product__Payment_Status="Received"
    ).update(Approval_Status="Received")


class Migration(migrations.Migration):
    dependencies = [
        ("Inquiry", "0007_paymentdetail"),
    ]

    operations = [
        migrations.AddField(
            model_name="paymentdetail",
            name="Approval_Status",
            field=models.CharField(
                choices=[("Pending", "Pending"), ("Received", "Received")],
                db_column="Approval_Status",
                default="Pending",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="paymentdetail",
            name="Approved_By",
            field=models.ForeignKey(
                blank=True,
                db_column="Approved_By",
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="approved_payment_details",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name="paymentdetail",
            name="Approved_On",
            field=models.DateTimeField(
                blank=True,
                db_column="Approved_On",
                null=True,
            ),
        ),
        migrations.RunPython(
            set_historical_payment_approval_statuses,
            migrations.RunPython.noop,
        ),
    ]
