from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("Inquiry", "0018_productbilling_payment_status"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ProductBillingFollowUp",
            fields=[
                ("FollowUp_Id", models.AutoField(db_column="FollowUp_Id", primary_key=True, serialize=False)),
                ("FollowUp_Date", models.DateField(db_column="FollowUp_Date")),
                ("FollowUp_Type", models.CharField(choices=[("call", "Call"), ("email", "Email"), ("meeting", "Meeting")], db_column="FollowUp_Type", default="call", max_length=10)),
                ("Notes", models.TextField(blank=True, db_column="Notes")),
                ("Created_On", models.DateTimeField(auto_now_add=True, db_column="Created_On")),
                ("Created_By", models.ForeignKey(db_column="Created_By", on_delete=django.db.models.deletion.PROTECT, to=settings.AUTH_USER_MODEL)),
                ("Product_Billing", models.ForeignKey(db_column="Product_Billing_Id", on_delete=django.db.models.deletion.CASCADE, related_name="payment_follow_ups", to="Inquiry.productbilling")),
            ],
            options={"db_table": "ProductBillingFollowUp_tbl", "ordering": ["-FollowUp_Date", "-FollowUp_Id"]},
        ),
    ]
