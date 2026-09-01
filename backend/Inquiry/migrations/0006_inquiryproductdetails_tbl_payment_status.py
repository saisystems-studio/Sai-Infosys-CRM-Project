from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("Inquiry", "0005_inquiryproductdetails_tbl_revenue_amount"),
    ]

    operations = [
        migrations.AddField(
            model_name="inquiryproductdetails_tbl",
            name="Payment_Status",
            field=models.CharField(
                db_column="Payment_Status",
                default="Pending",
                max_length=20,
            ),
        ),
    ]
