from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("Inquiry", "0006_inquiryproductdetails_tbl_payment_status")]

    operations = [
        migrations.CreateModel(
            name="PaymentDetail",
            fields=[
                ("Id", models.AutoField(db_column="Id", primary_key=True, serialize=False)),
                ("Amount", models.DecimalField(db_column="Amount", decimal_places=2, max_digits=12)),
                ("Payment_Type", models.CharField(choices=[("full", "Full Payment"), ("installment", "Installment")], db_column="Payment_Type", max_length=20)),
                ("Payment_Date", models.DateTimeField(auto_now_add=True, db_column="Payment_Date")),
                ("Created_On", models.DateTimeField(auto_now_add=True, db_column="Created_On")),
                ("Created_By", models.ForeignKey(db_column="Created_By", on_delete=django.db.models.deletion.PROTECT, to=settings.AUTH_USER_MODEL)),
                ("Inquiry_Product", models.ForeignKey(db_column="Inquiry_Product_Id", on_delete=django.db.models.deletion.CASCADE, related_name="payment_details", to="Inquiry.inquiryproductdetails_tbl")),
            ],
            options={"db_table": "PaymentDetail_tbl"},
        ),
    ]
