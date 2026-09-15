from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("Inquiry", "0012_productbilling")]

    operations = [
        migrations.AddField(
            model_name="productbilling",
            name="CGST_Percentage",
            field=models.DecimalField(blank=True, db_column="CGST_Percentage", decimal_places=2, max_digits=5, null=True),
        ),
        migrations.AddField(
            model_name="productbilling",
            name="SGST_Percentage",
            field=models.DecimalField(blank=True, db_column="SGST_Percentage", decimal_places=2, max_digits=5, null=True),
        ),
    ]
