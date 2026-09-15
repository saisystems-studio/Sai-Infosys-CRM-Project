from django.db import migrations


def rename_customer_business_summary_menu(apps, schema_editor):
    MenuMaster = apps.get_model("masters", "MenuMaster")
    MenuMaster.objects.filter(
        Menu_Name="Customer Business Summary Report"
    ).update(Menu_Name="Customer Business Summary")


def restore_customer_business_summary_menu(apps, schema_editor):
    MenuMaster = apps.get_model("masters", "MenuMaster")
    MenuMaster.objects.filter(
        Menu_Name="Customer Business Summary"
    ).update(Menu_Name="Customer Business Summary Report")


class Migration(migrations.Migration):
    dependencies = [("masters", "0016_customer_business_summary_report_menu")]

    operations = [
        migrations.RunPython(
            rename_customer_business_summary_menu,
            restore_customer_business_summary_menu,
        )
    ]
