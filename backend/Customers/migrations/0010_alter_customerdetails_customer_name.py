from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("Customers", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="customerdetails",
            name="customer_name",
            field=models.CharField(
                blank=True,
                db_column="Customer_Name",
                max_length=500,
                null=True,
            ),
        ),
    ]