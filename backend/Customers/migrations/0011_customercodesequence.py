import re

from django.db import migrations, models


def initialize_customer_code_sequence(apps, schema_editor):
    CustomerDetails = apps.get_model("Customers", "CustomerDetails")
    CustomerCodeSequence = apps.get_model("Customers", "CustomerCodeSequence")
    maximum = 0
    pattern = re.compile(r"CUST(\d+)SAI")

    for code in CustomerDetails.objects.values_list("customer_code", flat=True):
        match = pattern.fullmatch(code or "")
        if match:
            maximum = max(maximum, int(match.group(1)))

    CustomerCodeSequence.objects.create(id=1, last_serial=maximum)


class Migration(migrations.Migration):
    dependencies = [("Customers", "0010_alter_customerdetails_customer_name")]

    operations = [
        migrations.CreateModel(
            name="CustomerCodeSequence",
            fields=[
                (
                    "id",
                    models.PositiveSmallIntegerField(
                        default=1,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("last_serial", models.PositiveBigIntegerField(default=0)),
            ],
            options={"db_table": "CustomerCodeSequence_tbl"},
        ),
        migrations.RunPython(
            initialize_customer_code_sequence,
            migrations.RunPython.noop,
        ),
    ]
