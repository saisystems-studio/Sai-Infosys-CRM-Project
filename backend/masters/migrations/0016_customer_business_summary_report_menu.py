from django.db import migrations


def add_customer_business_summary_report(apps, schema_editor):
    MenuMaster = apps.get_model("masters", "MenuMaster")
    reports, _ = MenuMaster.objects.get_or_create(
        Menu_Name="Reports",
        defaults={"Icon": "chart", "Display_Order": 90, "Is_Active": True},
    )
    MenuMaster.objects.update_or_create(
        Menu_Name="Customer Business Summary Report",
        defaults={
            "Parent_Id": reports,
            "Icon": "chart",
            "Display_Order": 94,
            "Is_Active": True,
        },
    )


class Migration(migrations.Migration):
    dependencies = [("masters", "0015_staff_performance_report_permissions")]
    operations = [
        migrations.RunPython(
            add_customer_business_summary_report,
            migrations.RunPython.noop,
        )
    ]
