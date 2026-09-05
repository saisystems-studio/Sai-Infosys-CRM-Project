from django.db import models
from masters.models import CustomerTypeMaster, RatingTypeMaster
from django.contrib.auth.models import User
from masters.models import LicenseTypeMaster


#Customer Details Model

#startregion

class CustomerDetails(models.Model):
    id = models.AutoField(db_column='Id', primary_key=True)

    customer_code = models.CharField(
        db_column='Customer_Code',
        max_length=50,
        unique=True
    )

    customer_name = models.CharField(
        db_column='Customer_Name',
        max_length=500,
        null=True,
        blank=True
    )

    company_name = models.CharField(
        db_column='Company_Name',
        max_length=250,
        null=True,
        blank=True
    )

    email_id = models.EmailField(
        db_column='Email_Id',
        null=True,
        blank=True
    )

    customer_type = models.ForeignKey(
        CustomerTypeMaster,
        db_column='Customer_Type_Id',
        on_delete=models.PROTECT,
        null=True,
        blank=True
    )

    address = models.TextField(
        db_column='Address',
        null=True,
        blank=True
    )

    pincode = models.CharField(
        db_column='Pincode',
        max_length=20,
        null=True,
        blank=True
    )

    city = models.CharField(
        db_column='City',
        max_length=100,
        null=True,
        blank=True
    )

    state = models.CharField(
        db_column='State',
        max_length=100,
        null=True,
        blank=True
    )

    country = models.CharField(
        db_column='Country',
        max_length=100,
        null=True,
        blank=True
    )

    gst_number = models.CharField(
        db_column='GST_Number',
        max_length=50,
        null=True,
        blank=True
    )

    customer_rating = models.ForeignKey(
        RatingTypeMaster,
        db_column='Customer_Rating_Id',
        on_delete=models.PROTECT,
        null=True,
        blank=True
    )

    notes = models.TextField(
        db_column='Notes',
        null=True,
        blank=True
    )

    created_by = models.ForeignKey(
        User,
        db_column='Created_By',
        on_delete=models.PROTECT
    )

    created_on = models.DateTimeField(
        db_column='Created_On',
        auto_now_add=True
    )

    class Meta:
        db_table = 'CustomerDetails_tbl'

#endregion

#end of Customer Details Model

#-----------------------------------------------------------------------------------------------

class CustomerCodeSequence(models.Model):
    id = models.PositiveSmallIntegerField(primary_key=True, default=1, editable=False)
    last_serial = models.PositiveBigIntegerField(default=0)

    class Meta:
        db_table = 'CustomerCodeSequence_tbl'


#-----------------------------------------------------------------------------------------------

# Customer Contact Model

#startregion

class CustomerContact(models.Model):

    id = models.AutoField(
        db_column='Id',
        primary_key=True
    )

    customer = models.ForeignKey(
        CustomerDetails,
        db_column='Customer_Id',
        on_delete=models.CASCADE,
        related_name='contacts'
    )

    contact_name = models.CharField(
        db_column='Contact_Name',
        max_length=250
    )

    contact_number = models.CharField(
        db_column='Contact_Number',
        max_length=20
    )

    created_by = models.ForeignKey(
        User,
        db_column='Created_By',
        on_delete=models.PROTECT
    )

    created_on = models.DateTimeField(
        db_column='Created_On',
        auto_now_add=True
    )

    class Meta:
        db_table = 'CustomerContact_tbl'

#endregion

#end of Customer Contact Model

#-----------------------------------------------------------------------------------------------

# Customer License Model

#startregion

class CustomerLicenseDetails(models.Model):

    id = models.AutoField(
        db_column='Id',
        primary_key=True
    )

    customer = models.ForeignKey(
        CustomerDetails,
        db_column='Customer_Id',
        on_delete=models.CASCADE,
        related_name='licenses'
    )

    tally_serial_number = models.CharField(
        db_column='Tally_Serial_Number',
        max_length=100,
        null=True,
        blank=True
    )

    license_type = models.ForeignKey(
        LicenseTypeMaster,
        db_column='License_Type_Id',
        on_delete=models.PROTECT,
        null=True,
        blank=True
    )

    admin_id = models.CharField(
        db_column='AdminId',
        max_length=250,
        null=True,
        blank=True
    )

    expiry_date = models.DateField(
        db_column='Expiry_Date',
        null=True,
        blank=True
    )

    created_by = models.ForeignKey(
        User,
        db_column='Created_By',
        on_delete=models.PROTECT
    )

    created_on = models.DateTimeField(
        db_column='Created_On',
        auto_now_add=True
    )

    class Meta:
        db_table = 'CustomerLicenseDetails_tbl'

#endregion

#end of Customer License Model
