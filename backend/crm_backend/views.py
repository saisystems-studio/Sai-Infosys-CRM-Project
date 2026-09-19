from django.contrib.auth import get_user_model
from datetime import timedelta
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from django.db import transaction
from django.db.models import Exists, OuterRef, Prefetch, Q, Sum
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from staff.access import get_staff, has_full_access, menu_permission, normalize_role
from Customers.models import CustomerContact, CustomerDetails, CustomerLicenseDetails
from Inquiry.models import InquiryDetails_tbl, InquiryProductDetails_tbl, PaymentDetail, ProductBilling
from Inquiry.models import InquiryTaskProgress
from Inquiry.serializers import InquiryListSerializer
from staff.models import StaffDetails, StaffMenuPermission
from masters.models import LicenseTypeMaster, ProductTypeMaster


@api_view(["POST"])
@permission_classes([AllowAny])
def super_admin_login(request):
    identifier = str(request.data.get("email", "")).strip()
    password = str(request.data.get("password", ""))

    if not identifier or not password:
        return Response(
            {"detail": "Email and password are required."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    User = get_user_model()
    user = User.objects.filter(
        Q(email__iexact=identifier) | Q(username__iexact=identifier)
    ).first()

    if not user or not user.check_password(password):
        return Response(
            {"detail": "Invalid email or password."},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    staff = get_staff(user)

    if not user.is_active or (staff is not None and not staff.Is_Active):
        return Response(
            {"detail": "This account is inactive."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if not user.is_superuser and staff is None:
        return Response(
            {"detail": "This account is not linked to an active staff profile."},
            status=status.HTTP_403_FORBIDDEN,
        )

    refresh = RefreshToken.for_user(user)
    return Response({
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": {
            "id": user.pk,
            "name": user.get_full_name() or user.username,
            "email": user.email,
            "is_superuser": user.is_superuser,
            "staff_id": staff.Id if staff else None,
            "role": staff.Role if staff else "Super Admin",
            "has_full_access": has_full_access(user, staff),
        },
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def current_user(request):
    user = request.user
    staff = get_staff(user)
    return Response({
        "id": user.pk,
        "name": user.get_full_name() or user.username,
        "email": user.email,
        "is_superuser": user.is_superuser,
        "staff_id": staff.Id if staff else None,
        "role": staff.Role if staff else ("Super Admin" if user.is_superuser else ""),
        "has_full_access": has_full_access(user, staff),
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    staff = get_staff(request.user)
    full_access = has_full_access(request.user, staff)
    if full_access:
        inquiries = InquiryDetails_tbl.objects.all()
        customers = CustomerDetails.objects.all()
    elif staff is not None:
        inquiries = InquiryDetails_tbl.objects.filter(Resource_Id=staff.Id)
        customers = CustomerDetails.objects.filter(
            pk__in=inquiries.values("Customer_Id"),
        )
    else:
        inquiries = InquiryDetails_tbl.objects.none()
        customers = CustomerDetails.objects.none()

    completed_tasks = InquiryTaskProgress.objects.filter(
        Inquiry_Id=OuterRef("pk"),
        End_Time__isnull=False,
    )
    active_tasks = InquiryTaskProgress.objects.filter(
        Inquiry_Id=OuterRef("pk"),
        End_Time__isnull=True,
    )
    started_tasks = InquiryTaskProgress.objects.filter(Inquiry_Id=OuterRef("pk"))
    inquiries_with_started_task = inquiries.annotate(
        has_started_task=Exists(started_tasks),
    )
    requested_date = parse_date(request.query_params.get("date", ""))
    today = requested_date or timezone.localdate()
    if full_access:
        dashboard_inquiries = inquiries_with_started_task.filter(
            Shedule_Date=today,
        )
    else:
        dashboard_inquiries = inquiries_with_started_task.filter(
            Q(Shedule_Date=today) | Q(has_started_task=False),
        )
    total_revenue = InquiryProductDetails_tbl.objects.filter(
        Inquiry_Id__in=inquiries,
        Payment_Status="Received",
    ).aggregate(total=Sum("Revenue_Amount"))["total"] or 0
    total_invoice_amount = InquiryProductDetails_tbl.objects.filter(
        Inquiry_Id__in=inquiries,
    ).aggregate(total=Sum("Invoice_Amount"))["total"] or 0
    completed_inquiries = inquiries.annotate(
        has_completed_task=Exists(completed_tasks),
    ).filter(has_completed_task=True)
    completed_revenue = InquiryProductDetails_tbl.objects.filter(
        Inquiry_Id__in=completed_inquiries,
        Payment_Status="Received",
    ).aggregate(total=Sum("Revenue_Amount"))["total"] or 0

    dashboard_rows = InquiryListSerializer(
        dashboard_inquiries.order_by("Shedule_Date", "-Created_On").prefetch_related(
            Prefetch(
                "inquiryproductdetails_tbl_set",
                queryset=InquiryProductDetails_tbl.objects.select_related("ProductType_Id"),
            ),
        ),
        many=True,
        context={"request": request},
    ).data
    not_started_ids = set(
        dashboard_inquiries.filter(has_started_task=False).values_list("pk", flat=True)
    )
    for row in dashboard_rows:
        row["is_not_started"] = row["id"] in not_started_ids

    overdue_created_date = timezone.now().date() - timedelta(days=2)
    overdue_inquiries = inquiries.filter(
        Status_Id__status_type_name__iexact="In Progress",
        Created_On__date__lte=overdue_created_date,
    ).select_related("Customer_Id", "Status_Id", "Resource_Id").prefetch_related(
        Prefetch(
            "inquiryproductdetails_tbl_set",
            queryset=InquiryProductDetails_tbl.objects.select_related("ProductType_Id"),
        ),
    )
    overdue_rows = InquiryListSerializer(
        overdue_inquiries.order_by("Created_On"),
        many=True,
        context={"request": request},
    ).data
    for row in overdue_rows:
        row["in_progress_since"] = row["created_date"]
        row["overdue_basis"] = "created"
        row["is_overdue"] = True

    return Response({
        "totalCustomers": customers.count(),
        "totalInquiries": inquiries.count(),
        "totalRevenue": total_revenue,
        "totalInvoiceAmount": total_invoice_amount,
        "notStartedInquiries": inquiries.annotate(
            has_started_task=Exists(started_tasks),
        ).filter(has_started_task=False).count(),
        "inProgressSchedules": inquiries.annotate(
            has_active_task=Exists(active_tasks),
        ).filter(has_active_task=True).count(),
        "completedSchedules": completed_inquiries.count(),
        "completedRevenue": completed_revenue,
        "dashboardInquiries": dashboard_rows,
        "overdueInProgressInquiries": overdue_rows,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def customer_business_summary(request):
    staff = get_staff(request.user)
    if normalize_role(getattr(staff, "Role", "")) != "super admin":
        return Response(
            {"detail": "Only Super Admin can access the customer business summary report."},
            status=status.HTTP_403_FORBIDDEN,
        )

    customers = CustomerDetails.objects.select_related(
        "customer_type", "customer_rating"
    ).order_by("customer_name", "id")
    inquiries = InquiryDetails_tbl.objects.select_related(
        "Customer_Id", "Status_Id", "Source_Id", "Resource_Id"
    ).prefetch_related(
        Prefetch(
            "inquiryproductdetails_tbl_set",
            queryset=InquiryProductDetails_tbl.objects.select_related("ProductType_Id").only(
                "id", "Inquiry_Id", "ProductType_Id", "Amount",
                "ProductType_Id__Id", "ProductType_Id__product_type_name",
            ),
        ),
        Prefetch(
            "task_progress",
            queryset=InquiryTaskProgress.objects.only("id", "Inquiry_Id", "End_Time"),
        ),
    )
    # Only select legacy columns used by this report.  PaymentDetail has newer
    # billing fields, but installations that have not yet applied those schema
    # additions must still be able to open the customer summary.
    payments = PaymentDetail.objects.filter(Inquiry_Product__isnull=False).select_related(
        "Inquiry_Product__Inquiry_Id__Customer_Id",
        "Inquiry_Product__ProductType_Id",
        "Inquiry_Product__Inquiry_Id__Resource_Id",
    ).only(
        "Id", "Inquiry_Product", "Amount", "Payment_Date",
        "Inquiry_Product__id", "Inquiry_Product__Inquiry_Id",
        "Inquiry_Product__ProductType_Id",
        "Inquiry_Product__Inquiry_Id__id", "Inquiry_Product__Inquiry_Id__Customer_Id",
        "Inquiry_Product__Inquiry_Id__Resource_Id",
        "Inquiry_Product__ProductType_Id__Id", "Inquiry_Product__ProductType_Id__product_type_name",
        "Inquiry_Product__Inquiry_Id__Customer_Id__id",
        "Inquiry_Product__Inquiry_Id__Customer_Id__company_name",
        "Inquiry_Product__Inquiry_Id__Customer_Id__customer_name",
        "Inquiry_Product__Inquiry_Id__Resource_Id__Id",
        "Inquiry_Product__Inquiry_Id__Resource_Id__Full_Name",
    )

    customer_rows = [
        {
            "id": str(customer.id),
            "name": customer.customer_name or "Unknown Customer",
            "company": customer.company_name or "",
            "mobile": "",
            "email": customer.email_id or "",
            "customerType": customer.customer_type.customer_type_name
            if customer.customer_type else "",
            "rating": customer.customer_rating.rating_type_name
            if customer.customer_rating else "",
            "resource": "",
            "createdDate": customer.created_on.date().isoformat(),
            "location": ", ".join(
                value for value in [customer.city, customer.state, customer.country]
                if value
            ),
        }
        for customer in customers
    ]

    inquiry_rows = []
    schedule_rows = []
    for inquiry in inquiries:
        customer_id = str(inquiry.Customer_Id_id)
        resource = inquiry.Resource_Id.Full_Name if inquiry.Resource_Id else ""
        status_name = inquiry.Status_Id.status_type_name if inquiry.Status_Id else "New"
        inquiry_products = list(inquiry.inquiryproductdetails_tbl_set.all())
        task_progress = list(inquiry.task_progress.all())
        product = (
            inquiry_products[0].ProductType_Id.product_type_name
            if inquiry_products and inquiry_products[0].ProductType_Id else ""
        )
        expected_revenue = sum(
            (item.Amount or 0) for item in inquiry_products
        )
        inquiry_rows.append({
            "id": f"i-{inquiry.pk}",
            "customerId": customer_id,
            "product": product,
            "resource": resource,
            "date": inquiry.Created_On.date().isoformat(),
            "source": inquiry.Source_Id.source_type_name if inquiry.Source_Id else "",
            "status": status_name,
            "expectedRevenue": float(expected_revenue),
            "remarks": "",
            "taskProgressCount": len(task_progress),
            "hasActiveTask": any(progress.End_Time is None for progress in task_progress),
        })
        schedule_rows.append({
            "id": f"s-{inquiry.pk}",
            "customerId": customer_id,
            "product": product,
            "resource": resource,
            "date": inquiry.Shedule_Date.isoformat(),
            "createdDate": inquiry.Created_On.date().isoformat(),
            "completedDate": inquiry.Shedule_Date.isoformat()
            if status_name.lower() == "completed" else None,
            "status": status_name,
            "remarks": "",
        })

    transaction_rows = [
        {
            "id": f"p-{payment.pk}",
            "inquiryId": f"i-{payment.Inquiry_Product.Inquiry_Id_id}",
            "customerId": str(payment.Inquiry_Product.Inquiry_Id.Customer_Id_id),
            "product": payment.Inquiry_Product.ProductType_Id.product_type_name
            if payment.Inquiry_Product.ProductType_Id else "",
            "resource": payment.Inquiry_Product.Inquiry_Id.Resource_Id.Full_Name
            if payment.Inquiry_Product.Inquiry_Id.Resource_Id else "",
            "category": payment.Inquiry_Product.ProductType_Id.product_type_name
            if payment.Inquiry_Product.ProductType_Id else "Other",
            # Payment_Date is nullable for legacy payment records.  Keep those
            # rows in the report instead of failing the entire report request.
            "date": payment.Payment_Date.date().isoformat()
            if payment.Payment_Date else "",
            "amount": float(payment.Amount or 0),
            "remarks": "",
        }
        for payment in payments
    ]

    bill_rows = []
    for bill in ProductBilling.objects.select_related("Product_Id").prefetch_related("payment_details"):
        total = bill.Amount + bill.GST
        bill_rows.append({
            "id": f"b-{bill.pk}",
            "billId": bill.pk,
            "customerId": str(bill.Customer_Id_id),
            "date": bill.Created_On.date().isoformat(),
            "product": bill.Product_Id.product_type_name,
            "serialNumber": bill.License_Details or "",
            "quantity": float(bill.Quantity),
            "rate": float(bill.Rate),
            "gst": float(bill.GST),
            "expectedRevenue": float(total),
            "totalPaid": float(bill.Total_Paid),
            "balance": float(total - bill.Total_Paid),
            "status": bill.Payment_Status,
        })
        for payment in bill.payment_details.all():
            transaction_rows.append({
                "id": f"p-{payment.pk}",
                "billingId": f"b-{bill.pk}",
                "customerId": str(bill.Customer_Id_id),
                "product": bill.Product_Id.product_type_name,
                "resource": "",
                "category": "Product Sales",
                "date": payment.Payment_Date.date().isoformat() if payment.Payment_Date else "",
                "amount": float(payment.Amount or 0),
                "remarks": "",
            })

    return Response({
        "customers": customer_rows,
        "productBills": bill_rows,
        "inquiries": inquiry_rows,
        "schedules": schedule_rows,
        "transactions": transaction_rows,
        "events": [],
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def staff_daily_task_report(request):
    """Daily staff task activity, available exclusively to Super Admins."""
    staff = get_staff(request.user)
    is_super_admin = (
        normalize_role(getattr(staff, "Role", "")) == "super admin"
        or (request.user.is_superuser and staff is None)
    )
    if not is_super_admin:
        return Response(
            {"detail": "Only Super Admin can access the staff daily task report."},
            status=status.HTTP_403_FORBIDDEN,
        )

    requested_date = request.query_params.get("date", "")
    requested_from = request.query_params.get("from_date", "")
    requested_to = request.query_params.get("to_date", "")
    # This project stores task timestamps without timezone information
    # (USE_TZ=False), so timezone.localdate() raises on the resulting naive
    # datetime. timezone.now().date() is safe in either configuration.
    report_date = parse_date(requested_date) if requested_date else timezone.now().date()
    from_date = parse_date(requested_from) if requested_from else report_date
    to_date = parse_date(requested_to) if requested_to else report_date
    if from_date is None or to_date is None:
        return Response(
            {"detail": "Dates must use the YYYY-MM-DD format."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if from_date > to_date:
        return Response(
            {"detail": "From date cannot be after to date."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    tasks = InquiryTaskProgress.objects.filter(Work_Date__range=(from_date, to_date)).select_related(
        "Resource_Id", "Inquiry_Id__Customer_Id", "Inquiry_Id__Status_Id"
    ).prefetch_related("Inquiry_Id__inquiryproductdetails_tbl_set__ProductType_Id")
    resource_id = request.query_params.get("staff")
    if resource_id:
        tasks = tasks.filter(Resource_Id_id=resource_id)

    search = request.query_params.get("search", "").strip()
    if search:
        tasks = tasks.filter(
            Q(Resource_Id__Full_Name__icontains=search)
            | Q(Inquiry_Id__Customer_Id__customer_name__icontains=search)
            | Q(Inquiry_Id__Customer_Id__company_name__icontains=search)
            | Q(Progress_Notes__icontains=search)
        )

    task_rows = [
        {
            "id": task.pk,
            "work_date": task.Work_Date.isoformat(),
            "resource_id": task.Resource_Id_id,
            "resource_name": task.Resource_Id.Full_Name,
            "inquiry_id": task.Inquiry_Id_id,
            "customer_name": task.Inquiry_Id.Customer_Id.customer_name or "",
            "company_name": task.Inquiry_Id.Customer_Id.company_name or "",
            "products": [
                product.ProductType_Id.product_type_name
                for product in task.Inquiry_Id.inquiryproductdetails_tbl_set.all()
                if product.ProductType_Id
            ],
            "schedule_date": task.Inquiry_Id.Shedule_Date.isoformat(),
            "inquiry_status": (
                task.Inquiry_Id.Status_Id.status_type_name
                if task.Inquiry_Id.Status_Id else "New"
            ),
            "start_time": task.Start_Time.isoformat(),
            "end_time": task.End_Time.isoformat() if task.End_Time else None,
            "progress_notes": task.Progress_Notes,
            "task_status": task.Task_Status,
            "task_status_label": task.get_Task_Status_display(),
            "reschedule_at": task.Reschedule_At.isoformat() if task.Reschedule_At else None,
        }
        for task in tasks.order_by("Resource_Id__Full_Name", "Start_Time")
    ]
    completed = sum(task["end_time"] is not None for task in task_rows)
    unique_inquiries = {
        task.Inquiry_Id_id: task.Inquiry_Id
        for task in tasks
    }.values()
    total_amount = sum(
        (product.Amount or 0)
        for inquiry in unique_inquiries
        for product in inquiry.inquiryproductdetails_tbl_set.all()
    )
    revenue_amount = sum(
        (product.Revenue_Amount or 0)
        for inquiry in unique_inquiries
        for product in inquiry.inquiryproductdetails_tbl_set.all()
    )

    return Response({
        "date": report_date.isoformat(),
        "from_date": from_date.isoformat(),
        "to_date": to_date.isoformat(),
        "summary": {
            "total": len(task_rows),
            "completed": completed,
            "active": len(task_rows) - completed,
            "total_amount": total_amount,
            "revenue_amount": revenue_amount,
        },
        "staff": [
            {"id": staff.pk, "name": staff.Full_Name}
            for staff in StaffDetails.objects.filter(Is_Active=True).order_by("Full_Name")
        ],
        "tasks": task_rows,
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated, menu_permission("Licence Expiry Report")])
def license_expiry_report(request):
    """Customer licences expiring in a selected period for permitted staff."""

    requested_from = request.query_params.get("from_date", "")
    requested_to = request.query_params.get("to_date", "")
    today = timezone.now().date()
    month_start = today.replace(day=1)
    next_month_start = (month_start + timedelta(days=32)).replace(day=1)
    default_month_end = next_month_start - timedelta(days=1)
    from_date = parse_date(requested_from) if requested_from else month_start
    to_date = parse_date(requested_to) if requested_to else default_month_end
    if from_date is None or to_date is None:
        return Response(
            {"detail": "Dates must use the YYYY-MM-DD format."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if from_date > to_date:
        return Response(
            {"detail": "From date cannot be after to date."},
            status=status.HTTP_400_BAD_REQUEST,
        )

    licenses = CustomerLicenseDetails.objects.filter(
        expiry_date__range=(from_date, to_date),
        license_type__isnull=False,
    ).select_related("customer", "license_type").prefetch_related(
        "customer__contacts",
    )
    product_id = request.query_params.get("product_id", "").strip()
    if product_id:
        licenses = licenses.filter(license_type_id=product_id)

    products = LicenseTypeMaster.objects.order_by("license_type_name", "Id")

    rows = []
    for license in licenses.order_by(
        "expiry_date", "customer__company_name", "customer__customer_name", "id",
    ):
        contact = next(iter(license.customer.contacts.all()), None)
        rows.append({
            "id": license.id,
            "company_name": license.customer.company_name or license.customer.customer_name or "—",
            "contact_number": contact.contact_number if contact else "",
            "product_id": license.license_type_id,
            "product_name": license.license_type.license_type_name,
            "serial_number": license.tally_serial_number or "",
            "expiry_date": license.expiry_date.isoformat(),
        })

    return Response({
        "products": [
            {"id": product.Id, "name": product.license_type_name}
            for product in products
        ],
        "rows": rows,
    })


def _require_billing_access(request):
    staff = get_staff(request.user)
    if has_full_access(request.user, staff):
        return None
    if staff is None or not staff.Is_Active:
        return Response({"detail": "You do not have permission to access product billing."}, status=status.HTTP_403_FORBIDDEN)

    permission_filters = {
        "Staff": staff,
        "Menu__Menu_Name": "Product Billing",
        "Menu__Is_Active": True,
        "Can_View": True,
    }
    if request.method == "POST":
        permission_filters["Can_Add"] = True
    permitted = StaffMenuPermission.objects.filter(
        **permission_filters,
    ).exists()
    if not permitted:
        return Response({"detail": "You do not have permission to access product billing."}, status=status.HTTP_403_FORBIDDEN)
    return None


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def product_billing(request):
    denied = _require_billing_access(request)
    if denied:
        return denied
    if request.method == "GET":
        return Response([{
            "id": bill.Id, "customer_name": bill.Customer_Name, "company_name": bill.Company_Name,
            "contact_number": bill.Contact_Number, "license_details": bill.License_Details,
            "product": bill.Product_Id.product_type_name, "rate": bill.Rate, "quantity": bill.Quantity,
            "amount": bill.Amount, "is_external_renewal": bill.Is_External_Renewal, "has_gst": bill.Has_GST, "gst": bill.GST, "gst_percentage": bill.GST_Percentage, "hsn_code": bill.HSN_Code, "cgst": bill.CGST, "cgst_percentage": bill.CGST_Percentage,
            "sgst": bill.SGST, "sgst_percentage": bill.SGST_Percentage,
        } for bill in ProductBilling.objects.select_related("Product_Id")])
    data = request.data
    try:
        customer = CustomerDetails.objects.get(pk=data.get("customer_id"))
        raw_items = data.get("products")
        items = raw_items if isinstance(raw_items, list) else [data]
        if not items:
            raise ValueError
        bill_items = []
        for item in items:
            product = ProductTypeMaster.objects.get(pk=item.get("product_id"))
            rate, quantity, amount = (Decimal(str(item.get(key, ""))) for key in ("rate", "quantity", "amount"))
            is_external_renewal = bool(item.get("is_external_renewal", data.get("is_external_renewal")))
            has_gst = bool(item.get("has_gst"))
            if is_external_renewal and "tss" not in (product.product_type_name or "").lower():
                return Response({"detail": "External renewal can only be marked for TSS products."}, status=status.HTTP_400_BAD_REQUEST)
            if rate < 0 or quantity <= 0 or amount < 0:
                raise ValueError
            gst_percentage = (product.gst_percentage or Decimal("0")) if has_gst else Decimal("0")
            gst = (amount * gst_percentage / Decimal("100")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            bill_items.append((product, rate, quantity, amount, is_external_renewal, has_gst, gst_percentage, gst))
        selected_license = None
        selected_license_type = None
        license_expiry_date = None
        is_new_license = bool(data.get("is_new_license"))
        new_license_serial = ""
        license_admin_id = ""
        if is_new_license:
            new_license_serial = str(data.get("license_details", "")).strip()
            license_admin_id = str(data.get("license_admin_id", "")).strip()
            if not new_license_serial or not new_license_serial.isdigit() or len(new_license_serial) != 9:
                raise ValueError
            if not license_admin_id:
                raise ValueError
            if CustomerLicenseDetails.objects.filter(
                tally_serial_number__iexact=new_license_serial,
            ).exists():
                raise ValueError
            selected_license_type = LicenseTypeMaster.objects.get(
                pk=data.get("license_type_id"),
            )
            license_expiry_date = parse_date(
                str(data.get("license_expiry_date", "")),
            )
            if license_expiry_date is None:
                raise ValueError
        elif data.get("license_id"):
            selected_license = CustomerLicenseDetails.objects.get(
                pk=data["license_id"],
                customer=customer,
            )
            license_admin_id = str(data.get("license_admin_id", "")).strip()
            selected_license_type = LicenseTypeMaster.objects.get(
                pk=data.get("license_type_id"),
            )
            license_expiry_date = parse_date(
                str(data.get("license_expiry_date", "")),
            )
            if license_expiry_date is None:
                raise ValueError
    except (CustomerDetails.DoesNotExist, CustomerLicenseDetails.DoesNotExist, LicenseTypeMaster.DoesNotExist, ProductTypeMaster.DoesNotExist, InvalidOperation, ValueError):
        return Response({"detail": "Enter a valid customer, product, and non-negative billing values."}, status=status.HTTP_400_BAD_REQUEST)
    with transaction.atomic():
        if selected_license:
            if selected_license.license_type_id == selected_license_type.Id:
                selected_license.expiry_date = license_expiry_date
                selected_license.admin_id = license_admin_id
                selected_license.save(update_fields=["expiry_date", "admin_id"])
            else:
                CustomerLicenseDetails.objects.create(
                    customer=customer,
                    tally_serial_number=selected_license.tally_serial_number,
                    license_type=selected_license_type,
                    admin_id=license_admin_id,
                    expiry_date=license_expiry_date,
                    created_by=request.user,
                )
        if is_new_license:
            CustomerLicenseDetails.objects.create(
                customer=customer,
                tally_serial_number=new_license_serial,
                license_type=selected_license_type,
                admin_id=license_admin_id,
                expiry_date=license_expiry_date,
                created_by=request.user,
            )
        bills = [ProductBilling.objects.create(Customer_Id=customer, Contact_Number=str(data.get("contact_number", "")).strip(), Customer_Name=customer.customer_name or "", Company_Name=customer.company_name or "", License_Details=selected_license.tally_serial_number if selected_license else new_license_serial if is_new_license else str(data.get("license_details", "")).strip(), Product_Id=product, Rate=rate, Quantity=quantity, Amount=amount, Is_External_Renewal=is_external_renewal, Has_GST=has_gst, GST_Percentage=gst_percentage, GST=gst, HSN_Code=product.hsn_code or "", Created_By=request.user) for product, rate, quantity, amount, is_external_renewal, has_gst, gst_percentage, gst in bill_items]
    return Response({"id": bills[0].Id, "ids": [bill.Id for bill in bills], "detail": f"{len(bills)} product bill{'s' if len(bills) != 1 else ''} saved."}, status=status.HTTP_201_CREATED)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def product_billing_customer_lookup(request):
    denied = _require_billing_access(request)
    if denied:
        return denied
    search_query = str(request.query_params.get("query", "")).strip()
    customer_id = request.query_params.get("customer_id")

    # Include customer and contact names so users can find every customer they
    # are allowed to bill, even where no contact number has been saved yet.
    if search_query:
        # SQL Server cannot use DISTINCT on the whole customer row because it
        # includes text columns. De-duplicate only primary keys, then fetch
        # the customer records in a separate query.
        matching_customer_ids = (
            CustomerDetails.objects
            .filter(
                Q(customer_name__icontains=search_query)
                | Q(company_name__icontains=search_query)
                | Q(contacts__contact_name__icontains=search_query)
                | Q(contacts__contact_number__icontains=search_query),
            )
            .order_by()
            .values_list("pk", flat=True)
            .distinct()[:10]
        )
        matches = (
            CustomerDetails.objects
            .filter(pk__in=matching_customer_ids)
            .prefetch_related("contacts")
            .order_by("company_name", "customer_name")
        )
        return Response({
            "results": [
                {
                    "customer_id": customer.id,
                    "contact_number": (
                        next(iter(customer.contacts.all()), None).contact_number
                        if customer.contacts.all() else ""
                    ) or "",
                    "customer_name": customer.customer_name or "",
                    "company_name": customer.company_name or "",
                }
                for customer in matches
            ],
        })

    number = str(request.query_params.get("contact_number", "")).strip()
    if customer_id:
        customer = CustomerDetails.objects.prefetch_related(
            "contacts", "licenses__license_type",
        ).filter(pk=customer_id).first()
    else:
        contact = CustomerContact.objects.select_related("customer").filter(
            contact_number=number,
        ).first()
        customer = contact.customer if contact else None
    if not customer:
        return Response({"detail": "Customer not found."}, status=status.HTTP_404_NOT_FOUND)
    contact = customer.contacts.filter(contact_number=number).first() if number else customer.contacts.first()
    licenses = [
        {
            "id": license.id,
            "serial_number": license.tally_serial_number or "",
            "license_type_id": license.license_type_id or "",
            "admin_id": license.admin_id or "",
            "expiry_date": license.expiry_date.isoformat() if license.expiry_date else "",
        }
        for license in customer.licenses.all()
    ]
    return Response({
        "customer_id": customer.id,
        "contact_number": contact.contact_number if contact else "",
        "customer_name": customer.customer_name or "",
        "company_name": customer.company_name or "",
        "license_details": "",
        "license_options": licenses,
    })
