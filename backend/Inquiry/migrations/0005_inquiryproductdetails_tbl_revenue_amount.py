from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("Inquiry", "0004_inquirytaskprogress_reschedule_at_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="inquiryproductdetails_tbl",
            name="Revenue_Amount",
            field=models.DecimalField(
                blank=True,
                db_column="Revenue_Amount",
                decimal_places=2,
                max_digits=12,
                null=True,
            ),
        ),
    ]
