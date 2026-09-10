from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("Inquiry", "0009_inquiryproductdetails_tbl_invoice_amount"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PaymentFollowUp",
            fields=[
                (
                    "FollowUp_Id",
                    models.AutoField(
                        db_column="FollowUp_Id",
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "FollowUp_Date",
                    models.DateField(db_column="FollowUp_Date"),
                ),
                ("Notes", models.TextField(blank=True, db_column="Notes")),
                (
                    "Created_On",
                    models.DateTimeField(auto_now_add=True, db_column="Created_On"),
                ),
                (
                    "Created_By",
                    models.ForeignKey(
                        db_column="Created_By",
                        on_delete=django.db.models.deletion.PROTECT,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "Customer",
                    models.ForeignKey(
                        db_column="Customer_Id",
                        on_delete=django.db.models.deletion.CASCADE,
                        to="Customers.customerdetails",
                    ),
                ),
                (
                    "Inquiry_Product",
                    models.ForeignKey(
                        db_column="Inquiry_Product_Id",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="payment_follow_ups",
                        to="Inquiry.inquiryproductdetails_tbl",
                    ),
                ),
            ],
            options={
                "db_table": "PaymentFollowUp_tbl",
                "ordering": ["-FollowUp_Date", "-FollowUp_Id"],
            },
        ),
    ]
