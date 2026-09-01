from django.db import migrations


def add_payment_received_details_menu(apps, schema_editor):
    MenuMaster = apps.get_model("masters", "MenuMaster")
    MenuMaster.objects.get_or_create(
        Menu_Name="Payment Received Details",
        defaults={
            "Icon": "check",
            "Display_Order": 91,
            "Is_Active": True,
        },
    )


class Migration(migrations.Migration):
    dependencies = [
        ("masters", "0009_payment_approval_menu"),
    ]

    operations = [
        migrations.RunPython(
            add_payment_received_details_menu,
            migrations.RunPython.noop,
        ),
    ]
