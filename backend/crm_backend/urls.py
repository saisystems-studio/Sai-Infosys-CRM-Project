"""
URL configuration for crm_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from .sales_report import sales_report
from django.urls import path, include
from .views import (
    current_user,
    customer_business_summary,
    dashboard_stats,
    license_expiry_report,
    product_billing,
    product_billing_customer_lookup,
    staff_daily_task_report,
    super_admin_login,
)
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login/', super_admin_login, name='super-admin-login'),
    path('api/auth/me/', current_user, name='current-user'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='legacy-token-refresh'),
    path('api/dashboard-stats/', dashboard_stats, name='dashboard-stats'),
    path('api/customer-business-summary/', customer_business_summary, name='customer-business-summary'),
    path('api/license-expiry-report/', license_expiry_report, name='license-expiry-report'),
    path('api/sales-report/', sales_report, name='sales-report'),
    path('api/product-billing/', product_billing, name='product-billing'),
    path('api/product-billing/customer-lookup/', product_billing_customer_lookup, name='product-billing-customer-lookup'),
    path('api/staff-daily-task-report/', staff_daily_task_report, name='staff-daily-task-report'),
    path('api/', include('masters.urls')),
    path('api/', include('Customers.urls')),
    path('api/', include('Inquiry.urls')),
    path("api/", include("staff.urls")),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
# ==================================================
