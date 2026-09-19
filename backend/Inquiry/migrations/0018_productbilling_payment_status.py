from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [("Inquiry", "0017_inquiryproductdetails_tbl_is_amc")]

    operations = [
        migrations.AddField(
            model_name="productbilling",
            name="Total_Paid",
            field=models.DecimalField(db_column="Total_Paid", decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="productbilling",
            name="Payment_Status",
            field=models.CharField(db_column="Payment_Status", default="Pending", max_length=20),
        ),
    ]
