from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("Inquiry", "0010_payment_follow_up")]

    operations = [
        migrations.AddField(
            model_name="paymentfollowup",
            name="FollowUp_Type",
            field=models.CharField(
                blank=True,
                choices=[("call", "Call"), ("email", "Email"), ("meeting", "Meeting")],
                db_column="FollowUp_Type",
                default="",
                max_length=10,
            ),
        ),
    ]
