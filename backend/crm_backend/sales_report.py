from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from Inquiry.models import InquiryProductDetails_tbl, ProductBilling, TaskStatus
from staff.access import menu_permission
from staff.models import StaffDetails


@api_view(["GET"])
@permission_classes([IsAuthenticated, menu_permission("Sales report")])
def sales_report(request):
    dates = {}
    ids = {}
    try:
        for key in ("from_date", "to_date"):
            value = request.query_params.get(key, "").strip()
            if value:
                dates[key] = parse_date(value)
                if dates[key] is None:
                    raise ValueError()
        for key in ("product_id", "resource_id"):
            value = request.query_params.get(key, "").strip()
            if value:
                ids[key] = int(value)
                if ids[key] <= 0:
                    raise ValueError()
    except (ValueError, TypeError, OverflowError):
        return Response({"detail": "Use valid dates (YYYY-MM-DD) and filter selections."}, status=400)
    if dates.get("from_date") and dates.get("to_date") and dates["from_date"] > dates["to_date"]:
        return Response({"detail": "From date cannot be after to date."}, status=400)

    bills = ProductBilling.objects.select_related("Customer_Id", "Product_Id", "Created_By")
    # Keep options available when another filter produces no matching bills.
    products = {}
    resources = {}
    staff_names = dict(StaffDetails.objects.values_list("User_Id_id", "Full_Name"))
    rows = []
    cards = {}
    service_counts = {"unpaid_service": 0, "amc": 0}
    service_rows = []
    for bill in bills.order_by("-Created_On", "-Id"):
        product_name = bill.Product_Id.product_type_name or "Product"
        resource_name = staff_names.get(bill.Created_By_id) or bill.Created_By.get_full_name() or bill.Created_By.username
        products[bill.Product_Id_id] = product_name
        resources[bill.Created_By_id] = resource_name
        created = timezone.localtime(bill.Created_On) if timezone.is_aware(bill.Created_On) else bill.Created_On
        bill_date = created.date()
        if dates.get("from_date") and bill_date < dates["from_date"]:
            continue
        if dates.get("to_date") and bill_date > dates["to_date"]:
            continue
        if ids.get("product_id") and bill.Product_Id_id != ids["product_id"]:
            continue
        if ids.get("resource_id") and bill.Created_By_id != ids["resource_id"]:
            continue
        total = bill.Amount + bill.GST
        rows.append({
            "id": bill.pk, "billing_date": bill_date.isoformat(),
            "company_name": bill.Company_Name or bill.Customer_Id.company_name or bill.Customer_Name or bill.Customer_Id.customer_name,
            "product_id": bill.Product_Id_id, "product_name": product_name,
            "resource_id": bill.Created_By_id, "resource_name": resource_name,
            "paid_amount": f"{bill.Total_Paid:.2f}",
            "remaining_amount": f"{total - bill.Total_Paid:.2f}",
        })
        card = cards.setdefault(bill.Product_Id_id, {
            "product_id": bill.Product_Id_id,
            "product_name": product_name,
            "count": 0,
            "amount": 0,
            "revenue_amount": 0,
        })
        card["count"] += 1
        card["amount"] += total
        card["revenue_amount"] += bill.Total_Paid

    for card in cards.values():
        card["amount"] = f"{card['amount']:.2f}"
        card["revenue_amount"] = f"{card['revenue_amount']:.2f}"

    # Services completed from Schedule do not create ProductBilling entries.
    # Count their latest saved task so the selected period and resource mean the
    # same thing as they do for the work completed in Schedule.
    no_charge_products = (
        InquiryProductDetails_tbl.objects
        .filter(Payment_Status="Not Required")
        .select_related("Inquiry_Id__Customer_Id", "ProductType_Id")
        .prefetch_related("Inquiry_Id__task_progress")
    )
    for product in no_charge_products:
        completed_tasks = [
            item for item in product.Inquiry_Id.task_progress.all()
            if item.End_Time is not None and item.Task_Status == TaskStatus.PROGRESS_SAVED
        ]
        task = max(completed_tasks, key=lambda item: item.End_Time, default=None)
        if task is None:
            continue
        completed_date = timezone.localtime(task.End_Time).date() if timezone.is_aware(task.End_Time) else task.End_Time.date()
        if dates.get("from_date") and completed_date < dates["from_date"]:
            continue
        if dates.get("to_date") and completed_date > dates["to_date"]:
            continue
        if ids.get("product_id") and product.ProductType_Id_id != ids["product_id"]:
            continue
        if ids.get("resource_id") and task.Resource_Id.User_Id_id != ids["resource_id"]:
            continue
        if product.ProductType_Id_id:
            products[product.ProductType_Id_id] = product.ProductType_Id.product_type_name or "Product"
        resource_name = task.Resource_Id.Full_Name or task.Resource_Id.User_Id.get_full_name() or task.Resource_Id.User_Id.username
        resources[task.Resource_Id.User_Id_id] = resource_name
        service_type = "amc" if product.Is_AMC else "unpaid_service"
        service_counts[service_type] += 1
        customer = product.Inquiry_Id.Customer_Id
        service_rows.append({
            "id": product.pk,
            "completed_date": completed_date.isoformat(),
            "company_name": customer.company_name or customer.customer_name,
            "product_name": product.ProductType_Id.product_type_name if product.ProductType_Id else "Product",
            "resource_name": resource_name,
            "service_type": service_type,
        })
    return Response({
        "rows": rows,
        "cards": sorted(cards.values(), key=lambda card: card["product_name"].lower()),
        "products": [{"id": key, "name": name} for key, name in sorted(products.items(), key=lambda item: item[1].lower())],
        "resources": [{"id": key, "name": name} for key, name in sorted(resources.items(), key=lambda item: item[1].lower())],
        "service_counts": service_counts,
        "service_rows": service_rows,
    })
