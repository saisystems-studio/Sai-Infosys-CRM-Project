from django.db import models
from django.contrib.auth.models import User
from Customers.models import CustomerDetails
from masters.models import SourceTypeMaster, StatusTypeMaster, ProductTypeMaster
from staff.models import StaffDetails


#InquiryDetails_tbl model is used to store the details of the inquiry made by the customer.
#  It has a foreign key relationship with the CustomerDetails model, SourceTypeMaster_tbl model, 
#  StatusTypeMaster_tbl model, SourceTypeMaster_tbl model and User model. It also has fields for Shedule_Date, 
# Created_On and Created_Id.

#startregion InquiryDetails_tbl 



class InquiryDetails_tbl(models.Model):

    Customer_Id = models.ForeignKey(
        CustomerDetails,
        on_delete=models.CASCADE,
        db_column="Customer_Id"
    )

    Shedule_Date = models.DateField(
        db_column="Shedule_Date"
    )

    Resource_Id = models.ForeignKey(
        StaffDetails,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column="Resource_Id",
        related_name="assigned_inquiries"
    ) 

    Status_Id = models.ForeignKey(
        StatusTypeMaster,
        on_delete=models.SET_NULL,
        null=True,
        db_column="Status_Id"
    )

    Source_Id = models.ForeignKey(
        SourceTypeMaster,
        on_delete=models.SET_NULL,
        null=True,
        db_column="Source_Id"
    )

    Created_Id = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        db_column="Created_Id"
    )

    Created_On = models.DateTimeField(
        auto_now_add=True,
        db_column="Created_On"
    )

    class Meta:
        db_table = "InquiryDetails_tbl"

#endregion InquiryDetails_tbl

#--------------------------------------------------------------------------

#InquiryProductDetails_tbl model is used to store the details of the products in the inquiry made by the customer.

#startregion InquiryProductDetails_tbl

class InquiryProductDetails_tbl(models.Model):

    Inquiry_Id = models.ForeignKey(
        InquiryDetails_tbl,
        on_delete=models.CASCADE,
        db_column="Inquiry_Id"
    )

    ProductType_Id = models.ForeignKey(
        ProductTypeMaster,
        on_delete=models.SET_NULL,
        null=True,
        db_column="ProductType_Id"
    )

    Quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        db_column="Quantity"
    )

    Rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        db_column="Rate"
    )

    Amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        db_column="Amount"
    )

    Invoice_Amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        db_column="Invoice_Amount",
    )

    Revenue_Amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        db_column="Revenue_Amount",
    )

    Payment_Status = models.CharField(
        max_length=20,
        default="Pending",
        db_column="Payment_Status",
    )

    Requirment = models.TextField(
        blank=True,
        null=True,
        db_column="Requirment"
    )

    Created_By = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        db_column="Created_By"
    )

    Created_On = models.DateTimeField(
        auto_now_add=True,
        db_column="Created_On"
    )

    class Meta:
        db_table = "InquiryProductDetails_tbl"

#endregion InquiryProductDetails_tbl

#--------------------------------------------------------------------------


class PaymentDetail(models.Model):
    class PaymentType(models.TextChoices):
        FULL = "full", "Full Payment"
        INSTALLMENT = "installment", "Installment"

    class PaymentApprovalStatus(models.TextChoices):
        PENDING = "Pending", "Pending"
        RECEIVED = "Received", "Received"

    Id = models.AutoField(primary_key=True, db_column="Id")
    Inquiry_Product = models.ForeignKey(
        InquiryProductDetails_tbl,
        on_delete=models.CASCADE,
        related_name="payment_details",
        db_column="Inquiry_Product_Id",
    )
    Amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        db_column="Amount",
    )
    Payment_Type = models.CharField(
        max_length=20,
        choices=PaymentType.choices,
        db_column="Payment_Type",
    )
    Payment_Date = models.DateTimeField(auto_now_add=True, db_column="Payment_Date")
    Created_By = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        db_column="Created_By",
    )
    Created_On = models.DateTimeField(auto_now_add=True, db_column="Created_On")
    Approval_Status = models.CharField(
        max_length=20,
        choices=PaymentApprovalStatus.choices,
        default=PaymentApprovalStatus.PENDING,
        db_column="Approval_Status",
    )
    Approved_By = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="approved_payment_details",
        db_column="Approved_By",
    )
    Approved_On = models.DateTimeField(
        null=True,
        blank=True,
        db_column="Approved_On",
    )

    class Meta:
        db_table = "PaymentDetail_tbl"


#--------------------------------------------------------------------------



class TaskStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    PROGRESS_SAVED = "progress_saved", "Progress Saved"
    PAYMENT_PENDING = "payment_pending", "Payment Pending"
    RESCHEDULED = "rescheduled", "Rescheduled"


class InquiryTaskProgress(models.Model):
    Inquiry_Id = models.ForeignKey(
        InquiryDetails_tbl,
        on_delete=models.CASCADE,
        db_column="Inquiry_Id",
        related_name="task_progress",
    )

    Resource_Id = models.ForeignKey(
        StaffDetails,
        on_delete=models.PROTECT,
        db_column="Resource_Id",
        related_name="task_progress",
    )

    Work_Date = models.DateField(
        db_column="Work_Date",
    )

    Start_Time = models.DateTimeField(
        db_column="Start_Time",
    )

    End_Time = models.DateTimeField(
        null=True,
        blank=True,
        db_column="End_Time",
    )

    Reschedule_At = models.DateTimeField(
        null=True,
        blank=True,
        db_column="Reschedule_At",
    )

    Progress_Notes = models.TextField(
        blank=True,
        db_column="Progress_Notes",
    )

    Task_Status = models.CharField(
        max_length=20,
        choices=TaskStatus.choices,
        default=TaskStatus.ACTIVE,
        db_column="Task_Status",
    )

    Created_By = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        db_column="Created_By",
    )

    Created_On = models.DateTimeField(
        auto_now_add=True,
        db_column="Created_On",
    )

    Updated_On = models.DateTimeField(
        auto_now=True,
        db_column="Updated_On",
    )

    class Meta:
        db_table = "InquiryTaskProgress_tbl"
        ordering = ["-Start_Time"]
        constraints = [
            models.UniqueConstraint(
                fields=["Resource_Id"],
                condition=models.Q(End_Time__isnull=True),
                name="unique_active_task_per_resource",
            )
        ]
