from django.db import models
from django.contrib.auth.models import User

# Product Type Master Model

#startregion

class ProductTypeMaster(models.Model):

    Id = models.AutoField(
        primary_key=True,
        db_column="Id"
    )

    product_type_name = models.CharField(
        max_length=255,
        db_column="Product_Type_Name"
    )

    created_on = models.DateTimeField(
        auto_now_add=True,
        db_column="Created_On"
    )

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        db_column="Created_By"
    )

    class Meta:
        db_table = "ProductTypeMaster_tbl"

#endregion

#End of Product Type Master Model

#-----------------------------------------------------------------------------------------------

# Customer Type Master Model

#startregion

class CustomerTypeMaster(models.Model):

    Id = models.AutoField(
        primary_key=True,
        db_column="Id"
    )

    customer_type_name = models.CharField(
        max_length=255,
        db_column="Customer_Type_Name"
    )

    created_on = models.DateTimeField(
        auto_now_add=True,
        db_column="Created_On"
    )

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        db_column="Created_By"
    )

    class Meta:
        db_table = "CustomerTypeMaster_tbl"

#endregion

#end of Customer Type Master Model

#-----------------------------------------------------------------------------------------------

# Status Type Master Model

#startregion

class StatusTypeMaster(models.Model):

    Id = models.AutoField(
        primary_key=True,
        db_column="Id"
    )

    status_type_name = models.CharField(
        max_length=255,
        db_column="Status_Type_Name"
    )

    created_on = models.DateTimeField(
        auto_now_add=True,
        db_column="Created_On"
    )

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        db_column="Created_By"
    )

    class Meta:
        db_table = "StatusTypeMaster_tbl"

#endregion  

#end of Status Type Master Model

#-----------------------------------------------------------------------------------------------

# Source Type Master Model

#startregion

class SourceTypeMaster(models.Model):

    Id = models.AutoField(
        primary_key=True,
        db_column="Id"
    )

    source_type_name = models.CharField(
        max_length=255,
        db_column="Source_Type_Name"
    )

    created_on = models.DateTimeField(
        auto_now_add=True,
        db_column="Created_On"
    )

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        db_column="Created_By"
    )

    class Meta:
        db_table = "SourceTypeMaster_tbl"

#endregion

#end of Source Type Master Model

#-----------------------------------------------------------------------------------------------

# Rating Type Master Model

#startregion

class RatingTypeMaster(models.Model):

    Id = models.AutoField(
        primary_key=True,
        db_column="Id"
    )

    rating_type_name = models.CharField(
        max_length=255,
        db_column="Rating_Type_Name"
    )

    created_on = models.DateTimeField(
        auto_now_add=True,
        db_column="Created_On"
    )

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        db_column="Created_By"
    )

    class Meta:
        db_table = "RatingTypeMaster_tbl"

#endregion

#end of Rating Type Master Model

#-----------------------------------------------------------------------------------------------

# License Type Master Model

#startregion

class LicenseTypeMaster(models.Model):

    Id = models.AutoField(
        primary_key=True,
        db_column="Id"
    )

    license_type_name = models.CharField(
        max_length=255,
        db_column="License_Type_Name"
    )

    created_on = models.DateTimeField(
        auto_now_add=True,
        db_column="Created_On"
    )

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        db_column="Created_By"
    )

    class Meta:
        db_table = "LicenseTypeMaster_tbl"

#endregion

#end of License Type Master Model

#-----------------------------------------------------------------------------------------------

# Menu Master Model

#startregion

class MenuMaster(models.Model):
    Id = models.AutoField(primary_key=True, db_column="Id")
    Menu_Name = models.CharField(max_length=100, db_column="Menu_Name")
    Icon = models.CharField(max_length=50, null=True, blank=True, db_column="Icon")
    Parent_Id = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="SubMenus",
        db_column="Parent_Id"
    )
    Display_Order = models.IntegerField(default=0, db_column="Display_Order")
    Is_Active = models.BooleanField(default=True, db_column="Is_Active")

    class Meta:
        db_table = "MenuMaster_tbl"
        ordering = ["Display_Order", "Id"]

    def __str__(self):
        return self.Menu_Name

#endregion

#end of Menu Master Model