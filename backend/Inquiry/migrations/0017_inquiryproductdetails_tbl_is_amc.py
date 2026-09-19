from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("Inquiry", "0016_productbilling_has_gst"),
    ]

    operations = [
        migrations.AddField(
            model_name="inquiryproductdetails_tbl",
            name="Is_AMC",
            field=models.BooleanField(db_column="Is_AMC", default=False),
        ),
    ]
