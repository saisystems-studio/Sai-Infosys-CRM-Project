from django.db import migrations


def add_staff_daily_task_report_menu(apps, schema_editor):
    MenuMaster = apps.get_model("masters", "MenuMaster")
    reports, _ = MenuMaster.objects.get_or_create(
        Menu_Name="Reports",
        defaults={"Icon": "chart", "Display_Order": 90, "Is_Active": True},
    )
    MenuMaster.objects.update_or_create(
        Menu_Name="Staff Daily Task Report",
        defaults={
            "Parent_Id": reports,
            "Icon": "chart",
            "Display_Order": 95,
            "Is_Active": True,
        },
    )


class Migration(migrations.Migration):
    dependencies = [("masters", "0017_rename_customer_business_summary_menu")]

    operations = [
        migrations.RunPython(add_staff_daily_task_report_menu, migrations.RunPython.noop)
    ]
