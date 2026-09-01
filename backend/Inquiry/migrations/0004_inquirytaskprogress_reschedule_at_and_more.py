from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("Inquiry", "0003_inquirytaskprogress"),
    ]

    operations = [
        migrations.AddField(
            model_name="inquirytaskprogress",
            name="Reschedule_At",
            field=models.DateTimeField(
                blank=True,
                db_column="Reschedule_At",
                null=True,
            ),
        ),
        migrations.AlterField(
            model_name="inquirytaskprogress",
            name="Task_Status",
            field=models.CharField(
                choices=[
                    ("active", "Active"),
                    ("progress_saved", "Progress Saved"),
                    ("payment_pending", "Payment Pending"),
                    ("rescheduled", "Rescheduled"),
                ],
                db_column="Task_Status",
                default="active",
                max_length=20,
            ),
        ),
    ]