from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from Customers.models import CustomerDetails
from masters.models import ProductTypeMaster, SourceTypeMaster, StatusTypeMaster
from staff.models import StaffDetails
from .models import (
    InquiryDetails_tbl,
    InquiryProductDetails_tbl,
    InquiryTaskProgress,
    PaymentDetail,
    TaskStatus,
)
from .task_progress import can_update_inquiry_task


# ============================================================
# PRODUCT INPUT SERIALIZER
# ============================================================

class InquiryProductInputSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(
        queryset=ProductTypeMaster.objects.all()
    )
    qty = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=0.01,
    )
    rate = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("0"),
    )
    amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        required=False,
    )
    requirement = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
    )


class PaymentPendingSerializer(serializers.Serializer):
    invoice_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0"),
        required=False,
    )
    revenue_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0"),
        required=False,
        default=0,
    )


class PaymentApprovalSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source="Inquiry_Id.Customer_Id.customer_name")
    company_name = serializers.CharField(
        source="Inquiry_Id.Customer_Id.company_name",
        allow_null=True,
    )
    requirement = serializers.CharField(source="Requirment", allow_null=True)
    amount = serializers.DecimalField(source="Amount", max_digits=12, decimal_places=2)
    revenue_amount = serializers.DecimalField(
        source="Revenue_Amount",
        max_digits=12,
        decimal_places=2,
    )
    payment_status = serializers.CharField(source="Payment_Status", read_only=True)
    total_paid = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    remaining_balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    latest_payment_type = serializers.CharField(read_only=True, allow_null=True)
    latest_payment_date = serializers.DateTimeField(read_only=True, allow_null=True)

    class Meta:
        model = InquiryProductDetails_tbl
        fields = [
            "id",
            "Inquiry_Id",
            "customer_name",
            "company_name",
            "requirement",
            "amount",
            "revenue_amount",
            "total_paid",
            "remaining_balance",
            "latest_payment_type",
            "latest_payment_date",
            "payment_status",
        ]


class PaymentPendingListSerializer(PaymentApprovalSerializer):
    pass


class PaymentApprovalEntrySerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="Id", read_only=True)
    product_id = serializers.IntegerField(source="Inquiry_Product_id", read_only=True)
    customer_name = serializers.CharField(source="Inquiry_Product.Inquiry_Id.Customer_Id.customer_name")
    company_name = serializers.CharField(source="Inquiry_Product.Inquiry_Id.Customer_Id.company_name", allow_null=True)
    requirement = serializers.CharField(source="Inquiry_Product.Requirment", allow_null=True)
    revenue_amount = serializers.DecimalField(source="Inquiry_Product.Revenue_Amount", max_digits=12, decimal_places=2)
    payment_amount = serializers.DecimalField(source="Amount", max_digits=12, decimal_places=2)
    payment_type = serializers.CharField(source="Payment_Type", read_only=True)
    payment_date = serializers.DateTimeField(source="Payment_Date", read_only=True)
    payment_status = serializers.CharField(source="Inquiry_Product.Payment_Status", read_only=True)
    total_paid = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    remaining_balance = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    is_latest_payment = serializers.BooleanField(read_only=True)
    approval_status = serializers.CharField(source="Approval_Status", read_only=True)
    approved_by = serializers.CharField(source="Approved_By.username", read_only=True, allow_null=True)
    approved_on = serializers.DateTimeField(source="Approved_On", read_only=True, allow_null=True)

    class Meta:
        model = PaymentDetail
        fields = [
            "id", "product_id", "customer_name", "company_name", "requirement",
            "revenue_amount", "payment_amount", "payment_type", "payment_date",
            "total_paid", "remaining_balance", "payment_status", "is_latest_payment",
            "approval_status", "approved_by", "approved_on",
        ]


class PaymentRecordSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.01"),
    )
    payment_type = serializers.ChoiceField(choices=("full", "installment"))


# ============================================================
# PRODUCT LIST SERIALIZER
# ============================================================

class InquiryProductListSerializer(serializers.ModelSerializer):
    product = serializers.IntegerField(
        source="ProductType_Id_id",
        read_only=True,
    )
    revenue_amount = serializers.DecimalField(
        source="Revenue_Amount",
        max_digits=12,
        decimal_places=2,
        read_only=True,
        allow_null=True,
    )
    product_name = serializers.SerializerMethodField()
    product_type_name = serializers.SerializerMethodField()

    # Lowercase aliases expected by the React inquiry-list page.
    qty = serializers.DecimalField(
        source="Quantity",
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )
    rate = serializers.DecimalField(
        source="Rate",
        max_digits=10,
        decimal_places=2,
        read_only=True,
    )
    amount = serializers.DecimalField(
        source="Amount",
        max_digits=12,
        decimal_places=2,
        read_only=True,
    )
    requirement = serializers.CharField(
        source="Requirment",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = InquiryProductDetails_tbl
        fields = [
            "id",
            "product",
            "ProductType_Id",
            "product_name",
            "product_type_name",
            "qty",
            "rate",
            "amount",
            "revenue_amount",
            "requirement",
            "Quantity",
            "Rate",
            "Amount",
            "Requirment",
        ]

    def get_product_name(self, obj):
        if obj.ProductType_Id:
            return obj.ProductType_Id.product_type_name or "Product"
        return "Product"

    def get_product_type_name(self, obj):
        return self.get_product_name(obj)


# ============================================================
# INQUIRY LIST/DETAIL SERIALIZER
# ============================================================

class InquiryListSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    phone_number = serializers.SerializerMethodField()
    email_id = serializers.SerializerMethodField()
    tally_serial_number = serializers.SerializerMethodField()

    status_name = serializers.SerializerMethodField()
    status_type_name = serializers.SerializerMethodField()

    source_name = serializers.SerializerMethodField()
    source_type_name = serializers.SerializerMethodField()

    rating_name = serializers.SerializerMethodField()
    rating_type_name = serializers.SerializerMethodField()
    rating_id = serializers.SerializerMethodField()

    resource_name = serializers.SerializerMethodField()

    products = serializers.SerializerMethodField()
    inquiry_products = serializers.SerializerMethodField()

    created_date = serializers.SerializerMethodField()
    schedule_date = serializers.SerializerMethodField()
    inquiry_date = serializers.SerializerMethodField()

    total = serializers.SerializerMethodField()
    can_move_to_payment_pending = serializers.SerializerMethodField()
    completed_task_duration_seconds = serializers.SerializerMethodField()
    active_task_started_at = serializers.SerializerMethodField()
    next_reschedule_at = serializers.SerializerMethodField()

    class Meta:
        model = InquiryDetails_tbl
        fields = [
            "id",
            "Customer_Id",
            "customer_name",
            "phone_number",
            "email_id",
            "tally_serial_number",
            "Status_Id",
            "status_name",
            "status_type_name",
            "Source_Id",
            "source_name",
            "source_type_name",
            "rating_name",
            "rating_type_name",
            "rating_id",
            "Resource_Id",
            "resource_name",
            "Shedule_Date",
            "schedule_date",
            "Created_On",
            "created_date",
            "inquiry_date",
            "products",
            "inquiry_products",
            "total",
            "can_move_to_payment_pending",
            "completed_task_duration_seconds",
            "active_task_started_at",
            "next_reschedule_at",
        ]
        read_only_fields = fields

    def get_customer_name(self, obj):
        customer = obj.Customer_Id
        return customer.customer_name if customer else "Unknown Customer"

    def get_phone_number(self, obj):
        customer = obj.Customer_Id
        if not customer:
            return ""
        contact = customer.contacts.first()
        return contact.contact_number if contact else ""

    def get_email_id(self, obj):
        customer = obj.Customer_Id
        if not customer:
            return ""
        return customer.email_id or ""

    def get_tally_serial_number(self, obj):
        customer = obj.Customer_Id
        if not customer:
            return ""
        license_record = customer.licenses.first()
        if not license_record:
            return ""
        return license_record.tally_serial_number or ""

    def get_status_name(self, obj):
        if not obj.Status_Id:
            return "New"
        return obj.Status_Id.status_type_name or "New"

    def get_status_type_name(self, obj):
        return self.get_status_name(obj)

    def get_source_name(self, obj):
        if not obj.Source_Id:
            return "—"
        return obj.Source_Id.source_type_name or "—"

    def get_source_type_name(self, obj):
        return self.get_source_name(obj)

    def get_rating_name(self, obj):
        customer = obj.Customer_Id
        if not customer or not customer.customer_rating:
            return ""
        return customer.customer_rating.rating_type_name or ""

    def get_rating_type_name(self, obj):
        return self.get_rating_name(obj)

    def get_rating_id(self, obj):
        customer = obj.Customer_Id
        return customer.customer_rating_id if customer else None

    def get_resource_name(self, obj):
        if not obj.Resource_Id:
            return "—"
        return obj.Resource_Id.Full_Name

    def get_schedule_date(self, obj):
        if obj.Shedule_Date:
            return obj.Shedule_Date.strftime("%Y-%m-%d")
        return None

    def get_created_date(self, obj):
        if obj.Created_On:
            return obj.Created_On.isoformat()
        return None

    def get_inquiry_date(self, obj):
        return self.get_created_date(obj)

    def get_product_records(self, obj):
        return obj.inquiryproductdetails_tbl_set.all()

    def get_products(self, obj):
        products = self.get_product_records(obj)
        return InquiryProductListSerializer(products, many=True).data

    def get_inquiry_products(self, obj):
        return self.get_products(obj)

    def get_total(self, obj):
        products = self.get_product_records(obj)
        return float(sum(product.Amount or 0 for product in products))

    def get_can_move_to_payment_pending(self, obj):
        request = self.context.get("request")
        if not request or not can_update_inquiry_task(request.user, obj):
            return False
        return obj.task_progress.filter(
            End_Time__isnull=False,
            Task_Status=TaskStatus.PROGRESS_SAVED,
        ).exists()

    def get_completed_task_duration_seconds(self, obj):
        return int(sum(
            (progress.End_Time - progress.Start_Time).total_seconds()
            for progress in obj.task_progress.all()
            if progress.End_Time is not None
        ))

    def get_active_task_started_at(self, obj):
        active = next(
            (
                progress
                for progress in obj.task_progress.all()
                if progress.End_Time is None
            ),
            None,
        )
        if not active:
            return None
        return serializers.DateTimeField().to_representation(active.Start_Time)

    def get_next_reschedule_at(self, obj):
        latest_progress = next(iter(obj.task_progress.all()), None)
        if (
            latest_progress is None
            or latest_progress.Task_Status != TaskStatus.RESCHEDULED
            or latest_progress.End_Time is None
        ):
            return None
        return serializers.DateTimeField().to_representation(
            latest_progress.Reschedule_At,
        )


class InquiryTaskProgressSerializer(serializers.ModelSerializer):
    work_date = serializers.DateField(source="Work_Date", read_only=True)
    start_time = serializers.DateTimeField(source="Start_Time", read_only=True)
    end_time = serializers.DateTimeField(source="End_Time", read_only=True)
    progress_notes = serializers.CharField(
        source="Progress_Notes",
        read_only=True,
    )
    task_status = serializers.CharField(source="Task_Status", read_only=True)
    task_status_label = serializers.CharField(
        source="get_Task_Status_display",
        read_only=True,
    )
    resource_id = serializers.IntegerField(
        source="Resource_Id_id",
        read_only=True,
    )
    resource_name = serializers.CharField(
        source="Resource_Id.Full_Name",
        read_only=True,
    )
    reschedule_at = serializers.DateTimeField(
        source="Reschedule_At",
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = InquiryTaskProgress
        fields = [
            "id",
            "work_date",
            "start_time",
            "end_time",
            "progress_notes",
            "task_status",
            "task_status_label",
            "resource_id",
            "resource_name",
            "reschedule_at",
        ]
        read_only_fields = fields


class TaskProgressSaveSerializer(serializers.Serializer):
    progress_notes = serializers.CharField(trim_whitespace=True, allow_blank=True)
    outcome = serializers.ChoiceField(
        choices=(
            TaskStatus.PROGRESS_SAVED,
            TaskStatus.PAYMENT_PENDING,
            TaskStatus.RESCHEDULED,
        ),
    )
    reschedule_at = serializers.DateTimeField(required=False, allow_null=True)

    def validate(self, attrs):
        if attrs["outcome"] == TaskStatus.RESCHEDULED and not attrs.get("progress_notes"):
            attrs["progress_notes"] = "Call rescheduled"
        if attrs["outcome"] == TaskStatus.RESCHEDULED and not attrs.get("reschedule_at"):
            raise serializers.ValidationError({
                "reschedule_at": "Choose a callback date and time to reschedule this task."
            })
        return attrs


class InquiryTaskDetailSerializer(InquiryListSerializer):
    task_progress = serializers.SerializerMethodField()
    active_session = serializers.SerializerMethodField()
    can_update_task = serializers.SerializerMethodField()

    class Meta(InquiryListSerializer.Meta):
        fields = InquiryListSerializer.Meta.fields + [
            "task_progress",
            "active_session",
            "can_update_task",
        ]

    def get_task_progress(self, obj):
        progress = obj.task_progress.all()
        return InquiryTaskProgressSerializer(progress, many=True).data

    def get_active_session(self, obj):
        active = obj.task_progress.filter(End_Time__isnull=True).first()
        if not active:
            return None
        return InquiryTaskProgressSerializer(active).data

    def get_can_update_task(self, obj):
        request = self.context.get("request")
        return bool(request and can_update_inquiry_task(request.user, obj))


# ============================================================
# INQUIRY CREATE SERIALIZER
# ============================================================

class InquiryCreateSerializer(serializers.Serializer):

    customer_id = serializers.PrimaryKeyRelatedField(
        queryset=CustomerDetails.objects.all(),
    )

    customer_rating_id = serializers.IntegerField(
        required=False,
        allow_null=True,
    )

    schedule_date = serializers.DateField()

    resource_id = serializers.IntegerField(
        required=False,
        allow_null=True,
    )

    status_id = serializers.IntegerField(
        required=False,
        allow_null=True,
    )

    source_id = serializers.PrimaryKeyRelatedField(
        queryset=SourceTypeMaster.objects.all(),
        required=False,
        allow_null=True,
    )

    products = InquiryProductInputSerializer(
        many=True,
        allow_empty=False,
    )

    def validate_resource_id(self, value):
        if value is None:
            return value

        if not StaffDetails.objects.filter(
            pk=value,
            Is_Active=True
        ).exists():
            raise serializers.ValidationError(
                "The selected staff resource does not exist or is inactive."
            )

        return value

    def validate_status_id(self, value):
        if value is None:
            return value

        if not StatusTypeMaster.objects.filter(
            pk=value
        ).exists():
            raise serializers.ValidationError(
                "The selected status does not exist."
            )

        return value

    @transaction.atomic
    def create(self, validated_data):

        products = validated_data.pop("products")

        customer = validated_data.pop("customer_id")

        customer_rating_id = validated_data.pop(
            "customer_rating_id",
            None
        )

        resource_id = validated_data.pop(
            "resource_id",
            None
        )

        status_id = validated_data.pop(
            "status_id",
            None
        )

        source = validated_data.pop(
            "source_id",
            None
        )

        request = self.context["request"]

        # ========================================================
        # CUSTOMER RATING
        # ========================================================

        if customer_rating_id is not None:
            customer.customer_rating_id = customer_rating_id
            customer.save(
                update_fields=["customer_rating"]
            )

        # ========================================================
        # STATUS
        # ========================================================

        if status_id:
            status_obj = StatusTypeMaster.objects.filter(
                pk=status_id
            ).first()
        else:
            status_obj = StatusTypeMaster.objects.filter(
                status_type_name__iexact="New"
            ).first()

        if not status_obj:
            raise serializers.ValidationError({
                "status_id": "Status does not exist."
            })

        # ========================================================
        # CREATE INQUIRY
        # ========================================================

        inquiry = InquiryDetails_tbl.objects.create(

            Customer_Id=customer,

            Shedule_Date=validated_data[
                "schedule_date"
            ],

            Resource_Id_id=resource_id,

            Status_Id=status_obj,

            Source_Id=source,

            Created_Id=request.user,
        )

        # ========================================================
        # PRODUCTS
        # ========================================================

        product_records = []

        for product_data in products:

            quantity = product_data["qty"]

            rate = product_data["rate"]

            product_records.append(

                InquiryProductDetails_tbl(

                    Inquiry_Id=inquiry,

                    ProductType_Id=product_data[
                        "product"
                    ],

                    Quantity=quantity,

                    Rate=rate,

                    Amount=quantity * rate,

                    Requirment=product_data.get(
                        "requirement",
                        ""
                    ) or "",

                    Created_By=request.user,
                )
            )

        InquiryProductDetails_tbl.objects.bulk_create(
            product_records
        )

        return inquiry

    @transaction.atomic
    def update(self, instance, validated_data):
        products = validated_data.pop("products")
        customer = validated_data.pop("customer_id")
        customer_rating_id = validated_data.pop("customer_rating_id", None)
        resource_id = validated_data.pop("resource_id", None)
        status_id = validated_data.pop("status_id", None)
        source = validated_data.pop("source_id", None)
        request = self.context["request"]

        if customer_rating_id is not None:
            customer.customer_rating_id = customer_rating_id
            customer.save(update_fields=["customer_rating"])

        instance.Customer_Id = customer
        instance.Shedule_Date = validated_data["schedule_date"]
        instance.Resource_Id_id = resource_id
        instance.Status_Id_id = status_id
        instance.Source_Id_id = source.pk if source else None
        instance.save()

        instance.inquiryproductdetails_tbl_set.all().delete()
        product_records = [
            InquiryProductDetails_tbl(
                Inquiry_Id=instance,
                ProductType_Id=product_data["product"],
                Quantity=product_data["qty"],
                Rate=product_data["rate"],
                Amount=product_data["qty"] * product_data["rate"],
                Requirment=product_data.get("requirement", "") or "",
                Created_By=request.user,
            )
            for product_data in products
        ]
        InquiryProductDetails_tbl.objects.bulk_create(product_records)
        return instance

    def to_representation(self, instance):
        return {
            "id": instance.pk,
            "message": "Inquiry saved successfully",
        }
