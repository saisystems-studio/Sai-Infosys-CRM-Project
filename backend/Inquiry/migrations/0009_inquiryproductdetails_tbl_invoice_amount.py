from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("Inquiry", "0008_paymentdetail_approval"),
    ]

    operations = [
        migrations.AddField(
            model_name="inquiryproductdetails_tbl",
            name="Invoice_Amount",
            field=models.DecimalField(
                blank=True,
                db_column="Invoice_Amount",
                decimal_places=2,
                max_digits=12,
                null=True,
            ),
        ),
    ]
