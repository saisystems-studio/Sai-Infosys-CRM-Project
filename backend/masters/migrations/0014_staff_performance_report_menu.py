from django.db import migrations


def add_staff_performance_report_menu(apps, schema_editor):
    MenuMaster = apps.get_model("masters", "MenuMaster")
    reports, _ = MenuMaster.objects.get_or_create(
        Menu_Name="Reports",
        defaults={"Icon": "chart", "Display_Order": 90, "Is_Active": True},
    )
    MenuMaster.objects.update_or_create(
        Menu_Name="Staff Performance Report",
        defaults={
            "Parent_Id": reports,
            "Icon": "chart",
            "Display_Order": 93,
            "Is_Active": True,
        },
    )


class Migration(migrations.Migration):
    dependencies = [("masters", "0013_rename_payment_details_report")]

    operations = [
        migrations.RunPython(
            add_staff_performance_report_menu,
            migrations.RunPython.noop,
        )
    ]
