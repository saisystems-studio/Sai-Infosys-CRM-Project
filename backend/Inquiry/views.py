from rest_framework import mixins, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from django.db.models import BooleanField, Case, CharField, DateTimeField, DecimalField, ExpressionWrapper, F, OuterRef, Subquery, Sum, Value, When
from django.db.models.functions import Coalesce
from rest_framework.response import Response

from .models import InquiryDetails_tbl
from .serializers import (
    InquiryCreateSerializer,
    InquiryListSerializer,
    PaymentApprovalSerializer,
    PaymentApprovalEntrySerializer,
    PaymentPendingListSerializer,
    PaymentRecordSerializer,
    InquiryTaskDetailSerializer,
    InquiryTaskProgressSerializer,
    InvoiceAmountSerializer,
    CallbackRescheduleSerializer,
    PaymentPendingSerializer,
    TaskProgressSaveSerializer,
)
from .task_progress import (
    can_read_inquiry_task,
    move_inquiry_to_payment_pending,
    remove_active_inquiry_task,
    reschedule_callback,
    save_inquiry_progress,
    save_invoice_amount,
    start_inquiry_task,
)
from .payment_ledger import approve_payment_detail, record_payment
from staff.access import HasMenuPermission, get_staff, has_full_access, normalize_role
from staff.models import StaffDetails
from .models import InquiryProductDetails_tbl, PaymentDetail


class InquiryViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated, HasMenuPermission]
    menu_names = ("Inquiry List", "Add Inquiry")

    queryset = (
        InquiryDetails_tbl.objects
        .select_related(
            "Customer_Id",
            "Customer_Id__customer_rating",
            "Status_Id",
            "Source_Id",
            "Resource_Id",
            "Created_Id",
        )
        .prefetch_related(
            "Customer_Id__contacts",
            "Customer_Id__licenses",
            "inquiryproductdetails_tbl_set",
            "inquiryproductdetails_tbl_set__ProductType_Id",
        )
        .order_by("-Created_On")
    )

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action in ("task_detail", "schedule"):
            return queryset.prefetch_related("task_progress__Resource_Id")
        return queryset

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return InquiryCreateSerializer
        return InquiryListSerializer

    def _require_super_admin(self, request):
        staff = get_staff(request.user)
        role = normalize_role(getattr(staff, "Role", ""))
        if role != "super admin":
            raise PermissionDenied("Only Super Admin can access payment approvals.")

    def _require_payment_approval_viewer(self, request):
        staff = get_staff(request.user)
        role = normalize_role(getattr(staff, "Role", ""))
        if role not in {"admin", "super admin"}:
            raise PermissionDenied(
                "Only Admin and Super Admin can view payment approvals."
            )

    def _require_admin(self, request):
        staff = get_staff(request.user)
        role = str(getattr(staff, "Role", "") or "").strip().lower()
        if role != "admin":
            raise PermissionDenied(
                "Only Admin can access received payment details."
            )

    def _payment_summary_records(self, only_recorded=False):
        money_field = DecimalField(max_digits=12, decimal_places=2)
        latest_payment = PaymentDetail.objects.filter(
            Inquiry_Product_id=OuterRef("pk"),
        ).order_by("-Payment_Date", "-Id")
        records = InquiryProductDetails_tbl.objects.filter(Revenue_Amount__gt=0)
        if only_recorded:
            records = records.filter(payment_details__isnull=False)
        return (
            records
            .select_related("Inquiry_Id__Customer_Id")
            .annotate(
                total_paid=Coalesce(
                    Sum("payment_details__Amount"),
                    Value(0, output_field=money_field),
                    output_field=money_field,
                ),
            )
            .annotate(
                remaining_balance=ExpressionWrapper(
                    F("Revenue_Amount") - F("total_paid"),
                    output_field=money_field,
                ),
                latest_payment_type=Subquery(
                    latest_payment.values("Payment_Type")[:1],
                    output_field=CharField(),
                ),
                latest_payment_date=Subquery(
                    latest_payment.values("Payment_Date")[:1],
                    output_field=DateTimeField(),
                ),
            )
        )

    def _payment_approval_entries(self):
        money_field = DecimalField(max_digits=12, decimal_places=2)
        product_payments = PaymentDetail.objects.filter(
            Inquiry_Product_id=OuterRef("Inquiry_Product_id"),
        )
        total_paid = (
            product_payments.values("Inquiry_Product_id")
            .annotate(total=Sum("Amount"))
            .values("total")[:1]
        )
        latest_payment_id = product_payments.order_by(
            "-Payment_Date", "-Id"
        ).values("Id")[:1]
        return (
            PaymentDetail.objects
            .select_related("Inquiry_Product__Inquiry_Id__Customer_Id")
            .annotate(
                total_paid=Coalesce(
                    Subquery(total_paid, output_field=money_field),
                    Value(0, output_field=money_field),
                    output_field=money_field,
                ),
            )
            .annotate(
                remaining_balance=ExpressionWrapper(
                    F("Inquiry_Product__Revenue_Amount") - F("total_paid"),
                    output_field=money_field,
                ),
                is_latest_payment=Case(
                    When(Id=Subquery(latest_payment_id), then=Value(True)),
                    default=Value(False),
                    output_field=BooleanField(),
                ),
            )
            .order_by("-Payment_Date", "-Id")
        )

    @action(detail=False, methods=["get"], url_path="resources")
    def resources(self, request):
        resources = StaffDetails.objects.filter(Is_Active=True).order_by("Full_Name")
        return Response([
            {"Id": staff.Id, "Full_Name": staff.Full_Name}
            for staff in resources
        ])

    @action(detail=True, methods=["get"], url_path="task-detail")
    def task_detail(self, request, pk=None):
        inquiry = self.get_object()
        if not can_read_inquiry_task(request.user, inquiry):
            raise PermissionDenied("This inquiry is not assigned to you.")
        serializer = InquiryTaskDetailSerializer(
            inquiry,
            context={"request": request},
        )
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="start-task")
    def start_task(self, request, pk=None):
        progress = start_inquiry_task(
            inquiry=self.get_object(),
            user=request.user,
        )
        return Response(
            InquiryTaskProgressSerializer(progress).data,
            status=201,
        )

    @action(detail=True, methods=["post"], url_path="save-progress")
    def save_progress(self, request, pk=None):
        serializer = TaskProgressSaveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        progress = save_inquiry_progress(
            inquiry=self.get_object(),
            user=request.user,
            **serializer.validated_data,
        )
        return Response(InquiryTaskProgressSerializer(progress).data)

    @action(detail=True, methods=["post"], url_path="remove-task")
    def remove_task(self, request, pk=None):
        remove_active_inquiry_task(
            inquiry=self.get_object(),
            user=request.user,
        )
        return Response(status=204)

    @action(detail=True, methods=["post"], url_path="invoice-amount")
    def invoice_amount(self, request, pk=None):
        serializer = InvoiceAmountSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = save_invoice_amount(
            inquiry=self.get_object(),
            user=request.user,
            invoice_amount=serializer.validated_data["invoice_amount"],
        )
        return Response({"invoice_amount": f"{product.Invoice_Amount:.2f}"})

    @action(detail=True, methods=["post"], url_path="reschedule-callback")
    def reschedule_callback(self, request, pk=None):
        serializer = CallbackRescheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        progress = reschedule_callback(
            inquiry=self.get_object(),
            user=request.user,
            reschedule_at=serializer.validated_data["reschedule_at"],
        )
        return Response(InquiryTaskProgressSerializer(progress).data)

    @action(detail=True, methods=["post"], url_path="move-to-payment-pending")
    def move_to_payment_pending(self, request, pk=None):
        serializer = PaymentPendingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        inquiry = move_inquiry_to_payment_pending(
            inquiry=self.get_object(),
            user=request.user,
            invoice_amount=serializer.validated_data.get("invoice_amount"),
            revenue_amount=serializer.validated_data["revenue_amount"],
        )
        return Response(InquiryListSerializer(inquiry, context={"request": request}).data)

    @action(detail=False, methods=["get"], url_path="payment-approvals")
    def payment_approvals(self, request):
        self._require_payment_approval_viewer(request)
        records = self._payment_approval_entries()
        return Response(PaymentApprovalEntrySerializer(records, many=True).data)

    @action(detail=False, methods=["get"], url_path="payment-received-details")
    def payment_received_details(self, request):
        self._require_admin(request)
        records = (
            self._payment_summary_records()
            .filter(Payment_Status="Received")
            .order_by("-Created_On")
        )
        return Response(PaymentApprovalSerializer(records, many=True).data)

    @action(detail=False, methods=["get"], url_path="payment-pending")
    def payment_pending(self, request):
        self._require_payment_approval_viewer(request)
        records = (
            self._payment_summary_records()
            .filter(Payment_Status="Pending")
            .filter(remaining_balance__gt=0)
            .order_by("-Created_On")
        )
        return Response(PaymentPendingListSerializer(records, many=True).data)

    @action(
        detail=False,
        methods=["post"],
        url_path=r"payment-pending/(?P<product_id>[^/.]+)/paid",
    )
    def payment_paid(self, request, product_id=None):
        self._require_admin(request)
        serializer = PaymentRecordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product, total_paid, remaining_balance = record_payment(
            product_id=product_id,
            user=request.user,
            amount=serializer.validated_data["amount"],
            payment_type=serializer.validated_data["payment_type"],
        )
        return Response({
            "id": product.id,
            "total_paid": f"{total_paid:.2f}",
            "remaining_balance": f"{remaining_balance:.2f}",
            "payment_status": product.Payment_Status,
        })

    @action(
        detail=False,
        methods=["post"],
        url_path=r"payment-approvals/(?P<payment_detail_id>[^/.]+)/received",
    )
    def payment_received(self, request, payment_detail_id=None):
        self._require_super_admin(request)
        detail = approve_payment_detail(
            payment_detail_id=payment_detail_id,
            user=request.user,
        )
        return Response({
            "id": detail.Id,
            "approval_status": detail.Approval_Status,
            "payment_status": detail.Inquiry_Product.Payment_Status,
        })

    # ============================================================
    # SCHEDULE - NO STAFF RECORD NEEDED FOR ADMIN
    # ============================================================
    @action(
        detail=False,
        methods=["get"],
        url_path="schedule"
    )
    def schedule(self, request):
        staff = get_staff(request.user)

        if has_full_access(request.user, staff):
            # Admin/Super Admin: View ALL inquiries
            inquiries = self.get_queryset().exclude(
                Status_Id__status_type_name__iexact="Payment Pending"
            )
            serializer = InquiryListSerializer(
                inquiries,
                many=True,
                context={"request": request}
            )
            return Response(serializer.data)

        if staff is None:
            return Response(
                {
                    "detail": "Staff details not found for logged-in user."
                },
                status=400
            )

        # Regular Staff: View only their own assigned inquiries
        inquiries = (
            self.get_queryset()
            .filter(Resource_Id=staff.Id)
            .exclude(Status_Id__status_type_name__iexact="Payment Pending")
            .order_by(
                "Shedule_Date",
                "-Created_On"
            )
        )

        serializer = InquiryListSerializer(
            inquiries,
            many=True,
            context={"request": request}
        )
        return Response(serializer.data)
