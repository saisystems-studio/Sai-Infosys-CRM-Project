from django.db import migrations


def rename_payment_details_report(apps, schema_editor):
    MenuMaster = apps.get_model("masters", "MenuMaster")
    MenuMaster.objects.filter(Menu_Name="Payment Received Details").update(Menu_Name="Payement Details Report")


def restore_payment_received_details(apps, schema_editor):
    MenuMaster = apps.get_model("masters", "MenuMaster")
    MenuMaster.objects.filter(Menu_Name="Payement Details Report").update(Menu_Name="Payment Received Details")


class Migration(migrations.Migration):
    dependencies = [("masters", "0012_completed_inquery_report_menu")]
    operations = [migrations.RunPython(rename_payment_details_report, restore_payment_received_details)]
