from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("Inquiry", "0011_payment_follow_up_type"), ("Customers", "0001_initial"), ("masters", "0001_initial")]

    operations = [migrations.CreateModel(
        name="ProductBilling",
        fields=[
            ("Id", models.AutoField(db_column="Id", primary_key=True, serialize=False)),
            ("Contact_Number", models.CharField(db_column="Contact_Number", max_length=20)),
            ("Customer_Name", models.CharField(blank=True, db_column="Customer_Name", max_length=500)),
            ("Company_Name", models.CharField(blank=True, db_column="Company_Name", max_length=250)),
            ("License_Details", models.TextField(blank=True, db_column="License_Details")),
            ("Rate", models.DecimalField(db_column="Rate", decimal_places=2, max_digits=12)),
            ("Amount", models.DecimalField(db_column="Amount", decimal_places=2, max_digits=12)),
            ("Quantity", models.DecimalField(db_column="Quantity", decimal_places=2, max_digits=10)),
            ("Has_CGST", models.BooleanField(db_column="Has_CGST", default=False)),
            ("CGST", models.DecimalField(blank=True, db_column="CGST", decimal_places=2, max_digits=12, null=True)),
            ("Has_SGST", models.BooleanField(db_column="Has_SGST", default=False)),
            ("SGST", models.DecimalField(blank=True, db_column="SGST", decimal_places=2, max_digits=12, null=True)),
            ("Created_On", models.DateTimeField(auto_now_add=True, db_column="Created_On")),
            ("Created_By", models.ForeignKey(db_column="Created_By", on_delete=django.db.models.deletion.PROTECT, to="auth.user")),
            ("Customer_Id", models.ForeignKey(db_column="Customer_Id", on_delete=django.db.models.deletion.PROTECT, to="Customers.customerdetails")),
            ("Product_Id", models.ForeignKey(db_column="Product_Id", on_delete=django.db.models.deletion.PROTECT, to="masters.producttypemaster")),
        ], options={"db_table": "ProductBilling_tbl", "ordering": ["-Created_On", "-Id"]},
    )]
