from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("Inquiry", "0014_productbilling_external_renewal"),
        ("masters", "0020_producttypemaster_gst_hsn"),
    ]

    operations = [
        migrations.AddField(
            model_name="productbilling",
            name="GST_Percentage",
            field=models.DecimalField(db_column="GST_Percentage", decimal_places=2, default=0, max_digits=5),
        ),
        migrations.AddField(
            model_name="productbilling",
            name="GST",
            field=models.DecimalField(db_column="GST", decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="productbilling",
            name="HSN_Code",
            field=models.CharField(blank=True, db_column="HSN_Code", max_length=20),
        ),
    ]
