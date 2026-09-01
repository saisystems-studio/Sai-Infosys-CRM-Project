from django.db import migrations


def add_payment_approval_menu(apps, schema_editor):
    MenuMaster = apps.get_model("masters", "MenuMaster")
    MenuMaster.objects.get_or_create(
        Menu_Name="Payment Approval",
        defaults={
            "Icon": "dollar",
            "Display_Order": 90,
            "Is_Active": True,
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        ("masters", "0008_menumaster"),
    ]

    operations = [
        migrations.RunPython(add_payment_approval_menu, migrations.RunPython.noop),
    ]
