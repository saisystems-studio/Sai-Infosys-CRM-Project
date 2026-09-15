from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("Inquiry", "0015_productbilling_gst_hsn")]

    operations = [
        migrations.AddField(
            model_name="productbilling",
            name="Has_GST",
            field=models.BooleanField(db_column="Has_GST", default=False),
        ),
    ]
