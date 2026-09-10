from django.db import migrations


def grant_staff_performance_report_access(apps, schema_editor):
    MenuMaster = apps.get_model("masters", "MenuMaster")
    StaffDetails = apps.get_model("staff", "StaffDetails")
    StaffMenuPermission = apps.get_model("staff", "StaffMenuPermission")

    menu = MenuMaster.objects.filter(
        Menu_Name="Staff Performance Report",
        Is_Active=True,
    ).first()
    if not menu:
        return

    for staff in StaffDetails.objects.filter(Is_Active=True):
        StaffMenuPermission.objects.update_or_create(
            Staff=staff,
            Menu=menu,
            defaults={"Can_View": True},
        )


class Migration(migrations.Migration):
    dependencies = [
        ("masters", "0014_staff_performance_report_menu"),
        ("staff", "0003_staffdocument"),
    ]

    operations = [
        migrations.RunPython(
            grant_staff_performance_report_access,
            migrations.RunPython.noop,
        )
    ]
