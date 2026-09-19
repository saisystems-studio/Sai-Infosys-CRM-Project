from django.db import migrations


def add_sales_report(apps, schema_editor):
    Menu = apps.get_model("masters", "MenuMaster")
    menus = Menu.objects.using(schema_editor.connection.alias)
    reports, _ = menus.get_or_create(Menu_Name="Reports", defaults={"Icon": "chart", "Display_Order": 90, "Is_Active": True})
    menus.get_or_create(Menu_Name="Sales report", defaults={
        "Parent_Id": reports, "Icon": "chart", "Display_Order": 97, "Is_Active": True,
    })


class Migration(migrations.Migration):
    dependencies = [("masters", "0021_license_expiry_report_menu")]
    operations = [migrations.RunPython(add_sales_report, migrations.RunPython.noop)]
