from django.db import migrations


def add_product_billing_menu(apps, schema_editor):
    MenuMaster = apps.get_model("masters", "MenuMaster")
    MenuMaster.objects.update_or_create(
        Menu_Name="Product Billing",
        defaults={
            "Icon": "receipt",
            "Display_Order": 81,
            "Is_Active": True,
        },
    )


class Migration(migrations.Migration):
    dependencies = [("masters", "0018_staff_daily_task_report_menu")]

    operations = [migrations.RunPython(add_product_billing_menu, migrations.RunPython.noop)]
