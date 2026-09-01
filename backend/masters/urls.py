from django.urls import path
from . import views
from rest_framework.routers import DefaultRouter
from .views import MenuMasterViewSet


router = DefaultRouter()

router.register(
    r'menus',
    MenuMasterViewSet,
    basename='menus'
)


urlpatterns = [

    # Product Type Master

    path(
        'product-types/',
        views.product_type_master_list,
        name='product-type-list'
    ),

    path(
        'product-types/<int:pk>/',
        views.product_type_master_detail,
        name='product-type-detail'
    ),

    # Customer Type Master

    path(
        'customer-types/',
        views.customer_type_master_list,
        name='customer-type-list'
    ),

    path(
        'customer-types/<int:pk>/',
        views.customer_type_master_detail,
        name='customer-type-detail'
    ),

    # Status Type Master

    path(
        'status-types/',
        views.status_type_master_list,
        name='status-type-list'
    ),

    path(
        'status-types/<int:pk>/',
        views.status_type_master_detail,
        name='status-type-detail'
    ),

    # Source Type Master

    path(
        'source-types/',
        views.source_type_master_list,
        name='source-type-list'
    ),

    path(
        'source-types/<int:pk>/',
        views.source_type_master_detail,
        name='source-type-detail'
    ),

    # Rating Type Master

    path(
        'rating-types/',
        views.rating_type_master_list,
        name='rating-type-list'
    ),

    path(
        'rating-types/<int:pk>/',
        views.rating_type_master_detail,
        name='rating-type-detail'
    ),

    # License Type Master

    path(
        'license-types/',
        views.license_type_master_list,
        name='license-type-list'
    ),

    path(
        'license-types/<int:pk>/',
        views.license_type_master_detail,
        name='license-type-detail'
    ),

]


# Menu Master API
urlpatterns += router.urls