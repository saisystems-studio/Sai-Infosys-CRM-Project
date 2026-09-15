from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("Inquiry", "0013_productbilling_tax_percentages")]

    operations = [
        migrations.AddField(
            model_name="productbilling",
            name="Is_External_Renewal",
            field=models.BooleanField(db_column="Is_External_Renewal", default=False),
        ),
    ]
