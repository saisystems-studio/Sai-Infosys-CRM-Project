from django.db import migrations


def add_license_expiry_report_menu(apps, schema_editor):
    MenuMaster = apps.get_model("masters", "MenuMaster")
    reports, _ = MenuMaster.objects.get_or_create(
        Menu_Name="Reports",
        defaults={"Icon": "chart", "Display_Order": 90, "Is_Active": True},
    )
    MenuMaster.objects.update_or_create(
        Menu_Name="Licence Expiry Report",
        defaults={
            "Parent_Id": reports,
            "Icon": "chart",
            "Display_Order": 96,
            "Is_Active": True,
        },
    )


class Migration(migrations.Migration):
    dependencies = [("masters", "0020_producttypemaster_gst_hsn")]

    operations = [
        migrations.RunPython(add_license_expiry_report_menu, migrations.RunPython.noop),
    ]
