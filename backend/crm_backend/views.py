from django.contrib.auth import get_user_model
from django.db.models import Exists, OuterRef, Prefetch, Q, Sum
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from staff.access import get_staff, has_full_access, normalize_role
from Customers.models import CustomerDetails
from Inquiry.models import InquiryDetails_tbl, InquiryProductDetails_tbl, PaymentDetail
from Inquiry.models import InquiryTaskProgress
from Inquiry.serializers import InquiryListSerializer


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

    return Response({
        "totalCustomers": customers.count(),
        "totalInquiries": inquiries.count(),
        "totalRevenue": total_revenue,
        "notStartedInquiries": inquiries.annotate(
            has_started_task=Exists(started_tasks),
        ).filter(has_started_task=False).count(),
        "inProgressSchedules": inquiries.annotate(
            has_active_task=Exists(active_tasks),
        ).filter(has_active_task=True).count(),
        "completedSchedules": completed_inquiries.count(),
        "completedRevenue": completed_revenue,
        "dashboardInquiries": dashboard_rows,
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
        "inquiryproductdetails_tbl_set__ProductType_Id",
        "task_progress__Resource_Id",
    )
    payments = PaymentDetail.objects.select_related(
        "Inquiry_Product__Inquiry_Id__Customer_Id",
        "Inquiry_Product__ProductType_Id",
        "Inquiry_Product__Inquiry_Id__Resource_Id",
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
            "date": payment.Payment_Date.date().isoformat(),
            "amount": float(payment.Amount or 0),
            "remarks": "",
        }
        for payment in payments
    ]

    return Response({
        "customers": customer_rows,
        "inquiries": inquiry_rows,
        "schedules": schedule_rows,
        "transactions": transaction_rows,
        "events": [],
    })
