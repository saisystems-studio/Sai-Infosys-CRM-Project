from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("masters", "0019_product_billing_menu")]

    operations = [
        migrations.AddField(
            model_name="producttypemaster",
            name="gst_percentage",
            field=models.DecimalField(blank=True, db_column="GST_Percentage", decimal_places=2, max_digits=5, null=True),
        ),
        migrations.AddField(
            model_name="producttypemaster",
            name="hsn_code",
            field=models.CharField(blank=True, db_column="HSN_Code", max_length=20, null=True),
        ),
    ]
