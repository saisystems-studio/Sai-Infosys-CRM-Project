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

    Is_AMC = models.BooleanField(
        default=False,
        db_column="Is_AMC",
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
        null=True,
        blank=True,
    )
    Product_Billing = models.ForeignKey(
        "ProductBilling", on_delete=models.CASCADE, related_name="payment_details",
        db_column="Product_Billing_Id", null=True, blank=True,
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
    Payment_Date = models.DateTimeField(auto_now_add=True, null=True, db_column="Payment_Date")
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
        constraints = [models.CheckConstraint(
            condition=(
                models.Q(Inquiry_Product__isnull=False, Product_Billing__isnull=True)
                | models.Q(Inquiry_Product__isnull=True, Product_Billing__isnull=False)
            ),
            name="payment_detail_exactly_one_source",
        )]


class PaymentFollowUp(models.Model):
    FollowUp_Id = models.AutoField(primary_key=True, db_column="FollowUp_Id")
    Inquiry_Product = models.ForeignKey(
        InquiryProductDetails_tbl,
        on_delete=models.CASCADE,
        related_name="payment_follow_ups",
        db_column="Inquiry_Product_Id",
    )
    Customer = models.ForeignKey(
        CustomerDetails,
        on_delete=models.CASCADE,
        db_column="Customer_Id",
    )
    FollowUp_Date = models.DateField(db_column="FollowUp_Date")
    FollowUp_Type = models.CharField(
        max_length=10,
        choices=[("call", "Call"), ("email", "Email"), ("meeting", "Meeting")],
        blank=True,
        default="",
        db_column="FollowUp_Type",
    )
    Notes = models.TextField(blank=True, db_column="Notes")
    Created_By = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        db_column="Created_By",
    )
    Created_On = models.DateTimeField(auto_now_add=True, db_column="Created_On")

    class Meta:
        db_table = "PaymentFollowUp_tbl"
        ordering = ["-FollowUp_Date", "-FollowUp_Id"]


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


class ProductBilling(models.Model):
    Id = models.AutoField(primary_key=True, db_column="Id")
    Customer_Id = models.ForeignKey(
        CustomerDetails,
        on_delete=models.PROTECT,
        db_column="Customer_Id",
    )
    Contact_Number = models.CharField(max_length=20, db_column="Contact_Number")
    Customer_Name = models.CharField(max_length=500, blank=True, db_column="Customer_Name")
    Company_Name = models.CharField(max_length=250, blank=True, db_column="Company_Name")
    License_Details = models.TextField(blank=True, db_column="License_Details")
    Product_Id = models.ForeignKey(
        ProductTypeMaster,
        on_delete=models.PROTECT,
        db_column="Product_Id",
    )
    Rate = models.DecimalField(max_digits=12, decimal_places=2, db_column="Rate")
    Amount = models.DecimalField(max_digits=12, decimal_places=2, db_column="Amount")
    Revenue_Amount = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True, db_column="Revenue_Amount"
    )
    Quantity = models.DecimalField(max_digits=10, decimal_places=2, db_column="Quantity")
    Is_External_Renewal = models.BooleanField(default=False, db_column="Is_External_Renewal")
    Has_GST = models.BooleanField(default=False, db_column="Has_GST")
    GST_Percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0, db_column="GST_Percentage")
    GST = models.DecimalField(max_digits=12, decimal_places=2, default=0, db_column="GST")
    HSN_Code = models.CharField(max_length=20, blank=True, db_column="HSN_Code")
    Has_CGST = models.BooleanField(default=False, db_column="Has_CGST")
    CGST = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True, db_column="CGST"
    )
    CGST_Percentage = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True, db_column="CGST_Percentage"
    )
    Has_SGST = models.BooleanField(default=False, db_column="Has_SGST")
    SGST = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True, db_column="SGST"
    )
    SGST_Percentage = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True, db_column="SGST_Percentage"
    )
    Total_Paid = models.DecimalField(
        max_digits=12, decimal_places=2, default=0, db_column="Total_Paid"
    )
    Payment_Status = models.CharField(
        max_length=20, default="Pending", db_column="Payment_Status"
    )
    Created_By = models.ForeignKey(User, on_delete=models.PROTECT, db_column="Created_By")
    Created_On = models.DateTimeField(auto_now_add=True, db_column="Created_On")

    class Meta:
        db_table = "ProductBilling_tbl"
        ordering = ["-Created_On", "-Id"]

    @property
    def collection_amount(self):
        # Bills created before revenue was recorded retain their invoice balance.
        if self.Revenue_Amount is not None:
            return self.Revenue_Amount
        return self.Amount + self.GST


class ProductBillingFollowUp(models.Model):
    FollowUp_Id = models.AutoField(primary_key=True, db_column="FollowUp_Id")
    Product_Billing = models.ForeignKey(
        ProductBilling,
        on_delete=models.CASCADE,
        related_name="payment_follow_ups",
        db_column="Product_Billing_Id",
    )
    FollowUp_Date = models.DateField(db_column="FollowUp_Date")
    FollowUp_Type = models.CharField(
        max_length=10,
        choices=[("call", "Call"), ("email", "Email"), ("meeting", "Meeting")],
        default="call",
        db_column="FollowUp_Type",
    )
    Notes = models.TextField(blank=True, db_column="Notes")
    Created_By = models.ForeignKey(User, on_delete=models.PROTECT, db_column="Created_By")
    Created_On = models.DateTimeField(auto_now_add=True, db_column="Created_On")

    class Meta:
        db_table = "ProductBillingFollowUp_tbl"
        ordering = ["-FollowUp_Date", "-FollowUp_Id"]
