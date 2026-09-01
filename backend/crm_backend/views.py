from django.contrib.auth import get_user_model
from django.db.models import Exists, OuterRef, Q, Sum
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from staff.access import get_staff, has_full_access
from Customers.models import CustomerDetails
from Inquiry.models import InquiryDetails_tbl, InquiryProductDetails_tbl
from Inquiry.models import InquiryTaskProgress


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
    if has_full_access(request.user, staff):
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
    })
