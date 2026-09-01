from django.db import migrations


def add_completed_inquiry_report_menu(apps, schema_editor):
    MenuMaster = apps.get_model("masters", "MenuMaster")
    reports, _ = MenuMaster.objects.get_or_create(
        Menu_Name="Reports",
        defaults={"Icon": "chart", "Display_Order": 90, "Is_Active": True},
    )
    MenuMaster.objects.update_or_create(
        Menu_Name="Completed Inquery Report",
        defaults={
            "Parent_Id": reports,
            "Icon": "check",
            "Display_Order": 91,
            "Is_Active": True,
        },
    )
    MenuMaster.objects.filter(Menu_Name="Payment Received Details").update(
        Parent_Id=reports, Display_Order=92
    )


class Migration(migrations.Migration):
    dependencies = [("masters", "0011_payment_pending_menu")]

    operations = [
        migrations.RunPython(
            add_completed_inquiry_report_menu,
            migrations.RunPython.noop,
        )
    ]
