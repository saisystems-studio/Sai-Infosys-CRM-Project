from django.db import models
from django.contrib.auth.models import User


# ============================================================
# Staff Details
# ============================================================

class StaffDetails(models.Model):

    Id = models.AutoField(
        primary_key=True,
        db_column="Id"
    )

    Staff_Image = models.ImageField(
        upload_to="staff/",
        null=True,
        blank=True,
        db_column="Staff_Image"
    )

    Full_Name = models.CharField(
        max_length=200,
        db_column="Full_Name"
    )

    Designation = models.CharField(
        max_length=150,
        db_column="Designation"
    )

    Email_Address = models.EmailField(
        max_length=255,
        db_column="Email_Address"
    )

    Phone_Number = models.CharField(
        max_length=20,
        db_column="Phone_Number"
    )

    Hire_Date = models.DateField(
        db_column="Hire_Date"
    )

    Role = models.CharField(
        max_length=100,
        db_column="Role"
    )

    Is_Active = models.BooleanField(
        default=True,
        db_column="Is_Active"
    )

    # Django Login User
    User_Id = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="staff_details",
        db_column="User_Id"
    )

    # User who created this staff
    Created_By = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="staff_created_by",
        db_column="Created_By"
    )

    Created_On = models.DateTimeField(
        auto_now_add=True,
        db_column="Created_On"
    )

    class Meta:
        db_table = "StaffDetails_tbl"

    def __str__(self):
        return self.Full_Name


# ============================================================
# Staff Menu Permission
# ============================================================

class StaffMenuPermission(models.Model):

    Id = models.AutoField(
        primary_key=True,
        db_column="Id"
    )

    Staff = models.ForeignKey(
        StaffDetails,
        on_delete=models.CASCADE,
        related_name="MenuPermissions",
        db_column="Staff_Id"
    )

    Menu = models.ForeignKey(
        "masters.MenuMaster",
        on_delete=models.CASCADE,
        related_name="StaffPermissions",
        db_column="Menu_Id"
    )

    Can_View = models.BooleanField(
        default=True,
        db_column="Can_View"
    )

    Can_Add = models.BooleanField(
        default=False,
        db_column="Can_Add"
    )

    Can_Edit = models.BooleanField(
        default=False,
        db_column="Can_Edit"
    )

    Can_Delete = models.BooleanField(
        default=False,
        db_column="Can_Delete"
    )

    class Meta:
        db_table = "StaffMenuPermission_tbl"

        constraints = [
            models.UniqueConstraint(
                fields=["Staff", "Menu"],
                name="unique_staff_menu_permission"
            )
        ]

    def __str__(self):
        return f"{self.Staff.Full_Name} - {self.Menu.Menu_Name}"