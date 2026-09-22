from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("Inquiry", "0021_recover_product_bill_payments")]

    operations = [
        migrations.AddField(
            model_name="productbilling",
            name="Revenue_Amount",
            field=models.DecimalField(
                max_digits=12, decimal_places=2, null=True, blank=True,
                db_column="Revenue_Amount",
            ),
        ),
    ]
