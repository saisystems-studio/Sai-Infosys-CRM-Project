from django.db import migrations


def add_payment_pending_menu(apps, schema_editor):
    MenuMaster = apps.get_model("masters", "MenuMaster")
    MenuMaster.objects.get_or_create(
        Menu_Name="Payment Pending",
        defaults={
            "Icon": "clock",
            "Display_Order": 92,
            "Is_Active": True,
        },
    )


class Migration(migrations.Migration):
    dependencies = [("masters", "0010_payment_received_details_menu")]

    operations = [migrations.RunPython(add_payment_pending_menu, migrations.RunPython.noop)]
