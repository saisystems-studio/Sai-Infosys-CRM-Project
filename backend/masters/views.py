from rest_framework import viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from staff.access import HasMenuPermission, master_lookup_permission, menu_permission

from .models import ProductTypeMaster
from .serializers import LicenseTypeMasterSerializer, ProductTypeMasterSerializer
from .models import MenuMaster
from .serializers import MenuMasterSerializer


# API FOR THE PRODUCT TYPE MASTER

#startregion

# Get All And Save Product Type Master

@api_view(['GET', 'POST'])
@permission_classes([
    IsAuthenticated,
    master_lookup_permission("Product Type Master"),
])
def product_type_master_list(request):

    if request.method == 'GET':

        product_types = ProductTypeMaster.objects.all().order_by("-Id")
        serializer = ProductTypeMasterSerializer(product_types, many=True)

        return Response(serializer.data)

    elif request.method == 'POST':

        serializer = ProductTypeMasterSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save(created_by_id=1)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Edit and delete and Get By Id Product Type Master
@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated, menu_permission("Product Type Master")])
def product_type_master_detail(request, pk):
    try:
        product_type = ProductTypeMaster.objects.get(pk=pk)
    except ProductTypeMaster.DoesNotExist:
        return Response({"message": "Record Not Found"}, status=status.HTTP_404_NOT_FOUND)

# Single Record Get
    if request.method == 'GET':
        serializer = ProductTypeMasterSerializer(product_type)
        return Response(serializer.data)

# Update Record
    elif request.method == 'PUT':
        serializer = ProductTypeMasterSerializer(product_type, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors)
    
#delete Record
    elif request.method == 'DELETE':
        product_type.delete()
        return Response({"message": "Deleted Successfully"},status=status.HTTP_200_OK)


#endregion

#end of API FOR THE PRODUCT TYPE MASTER

#-----------------------------------------------------------------------------------------------


#API FOR THE CUSTOMER TYPE MASTER

#startregion

from .models import CustomerTypeMaster
from .serializers import CustomerTypeMasterSerializer

#Get All And Save Customer Type Master

@api_view(['GET','POST'])
@permission_classes([IsAuthenticated, menu_permission("Customer Type Master")])
def customer_type_master_list(request):

    if request.method == 'GET':
        data = CustomerTypeMaster.objects.all().order_by('-Id')
        serializer = CustomerTypeMasterSerializer(data,many=True)
        return Response(serializer.data)
    

    elif request.method == 'POST':

        serializer = CustomerTypeMasterSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save(created_by_id=1)
            return Response(serializer.data,status=status.HTTP_201_CREATED)

        return Response(serializer.errors,status=status.HTTP_400_BAD_REQUEST)

# Edit and delete and Get By Id Customer Type Master

@api_view(['GET','PUT','DELETE'])
@permission_classes([IsAuthenticated, menu_permission("Customer Type Master")])
def customer_type_master_detail(request,pk):

    try:
        customer_type = CustomerTypeMaster.objects.get(pk=pk)
    except CustomerTypeMaster.DoesNotExist:
        return Response(
            {"message":"Record Not Found"},
            status=status.HTTP_404_NOT_FOUND
        )

    if request.method == 'GET':
        serializer = CustomerTypeMasterSerializer(customer_type)
        return Response(serializer.data)

    elif request.method == 'PUT':

        serializer = CustomerTypeMasterSerializer(
            customer_type,
            data=request.data
        )

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)

        return Response(serializer.errors)

    elif request.method == 'DELETE':

        customer_type.delete()

        return Response(
            {"message":"Deleted Successfully"},
            status=status.HTTP_200_OK
        )

#endregion
#end of API FOR THE CUSTOMER TYPE MASTER

#-----------------------------------------------------------------------------------------------

#API FOR THE STATUS TYPE MASTER

#startregion

from .models import StatusTypeMaster
from .serializers import StatusTypeMasterSerializer

#Get By Id And Save Status Type Master

@api_view(['GET', 'POST'])
@permission_classes([
    IsAuthenticated,
    master_lookup_permission("Status Type Master"),
])
def status_type_master_list(request):

    if request.method == 'GET':

        data = StatusTypeMaster.objects.all().order_by('-Id')
        serializer = StatusTypeMasterSerializer(data, many=True)

        return Response(serializer.data)

    elif request.method == 'POST':

        serializer = StatusTypeMasterSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save(created_by_id=1)
            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

# Edit and delete and Getall Status Type Master

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated, menu_permission("Status Type Master")])
def status_type_master_detail(request, pk):

    try:
        status_type = StatusTypeMaster.objects.get(pk=pk)

    except StatusTypeMaster.DoesNotExist:
        return Response(
            {"message": "Record Not Found"},
            status=status.HTTP_404_NOT_FOUND
        )

    if request.method == 'GET':

        serializer = StatusTypeMasterSerializer(status_type)
        return Response(serializer.data)

    elif request.method == 'PUT':

        serializer = StatusTypeMasterSerializer(
            status_type,
            data=request.data
        )

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)

        return Response(serializer.errors)

    elif request.method == 'DELETE':

        status_type.delete()

        return Response(
            {"message": "Deleted Successfully"},
            status=status.HTTP_200_OK
        )
#endregion
#end of API FOR THE STATUS TYPE MASTER

#-----------------------------------------------------------------------------------------------

# API FOR THE SOURCE TYPE MASTER

# startregion

# Get All And Save Source Type Master

from .models import SourceTypeMaster
from .serializers import SourceTypeMasterSerializer

@api_view(['GET', 'POST'])
@permission_classes([
    IsAuthenticated,
    master_lookup_permission("Source Type Master"),
])
def source_type_master_list(request):

    if request.method == 'GET':

        data = SourceTypeMaster.objects.all().order_by('-Id')
        serializer = SourceTypeMasterSerializer(data, many=True)

        return Response(serializer.data)

    elif request.method == 'POST':

        serializer = SourceTypeMasterSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save(created_by_id=1)
            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


# Get By Id, Update and Delete Source Type Master

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated, menu_permission("Source Type Master")])
def source_type_master_detail(request, pk):

    try:
        source_type = SourceTypeMaster.objects.get(pk=pk)

    except SourceTypeMaster.DoesNotExist:
        return Response(
            {"message": "Record Not Found"},
            status=status.HTTP_404_NOT_FOUND
        )

    if request.method == 'GET':

        serializer = SourceTypeMasterSerializer(source_type)
        return Response(serializer.data)

    elif request.method == 'PUT':

        serializer = SourceTypeMasterSerializer(
            source_type,
            data=request.data
        )

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)

        return Response(serializer.errors)

    elif request.method == 'DELETE':

        source_type.delete()

        return Response(
            {"message": "Deleted Successfully"},
            status=status.HTTP_200_OK
        )

# endregion

# end of API FOR THE SOURCE TYPE MASTER

#-----------------------------------------------------------------------------------------------

# API FOR THE RATING TYPE MASTER

# startregion

from .models import RatingTypeMaster
from .serializers import RatingTypeMasterSerializer

# Get All And Save Rating Type Master

@api_view(['GET', 'POST'])
@permission_classes([
    IsAuthenticated,
    master_lookup_permission("Rating Type Master"),
])
def rating_type_master_list(request):

    if request.method == 'GET':

        data = RatingTypeMaster.objects.all().order_by('-Id')
        serializer = RatingTypeMasterSerializer(data, many=True)

        return Response(serializer.data)

    elif request.method == 'POST':

        serializer = RatingTypeMasterSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save(created_by_id=1)
            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


# Get By Id, Update and Delete Rating Type Master

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated, menu_permission("Rating Type Master")])
def rating_type_master_detail(request, pk):

    try:
        rating_type = RatingTypeMaster.objects.get(pk=pk)

    except RatingTypeMaster.DoesNotExist:
        return Response(
            {"message": "Record Not Found"},
            status=status.HTTP_404_NOT_FOUND
        )

    if request.method == 'GET':

        serializer = RatingTypeMasterSerializer(rating_type)
        return Response(serializer.data)

    elif request.method == 'PUT':

        serializer = RatingTypeMasterSerializer(
            rating_type,
            data=request.data
        )

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)

        return Response(serializer.errors)

    elif request.method == 'DELETE':

        rating_type.delete()

        return Response(
            {"message": "Deleted Successfully"},
            status=status.HTTP_200_OK
        )

# endregion

# end of API FOR THE RATING TYPE MASTER

#-----------------------------------------------------------------------------------------------

# API FOR THE LICENCE TYPE MASTER

# startregion

# Get All And Save Licence Type Master

from .models import LicenseTypeMaster
from .serializers import LicenseTypeMasterSerializer

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, menu_permission("License Type Master")])
def license_type_master_list(request):

    if request.method == 'GET':

        data = LicenseTypeMaster.objects.all().order_by('-Id')
        serializer = LicenseTypeMasterSerializer(data, many=True)

        return Response(serializer.data)

    elif request.method == 'POST':

        serializer = LicenseTypeMasterSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save(created_by_id=1)
            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )

        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


# Get By Id, Update and Delete Licence Type Master

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated, menu_permission("License Type Master")])
def license_type_master_detail(request, pk):

    try:
        licence_type = LicenseTypeMaster.objects.get(pk=pk)

    except LicenseTypeMaster.DoesNotExist:
        return Response(
            {"message": "Record Not Found"},
            status=status.HTTP_404_NOT_FOUND
        )

    if request.method == 'GET':

        serializer = LicenseTypeMasterSerializer(licence_type)
        return Response(serializer.data)

    elif request.method == 'PUT':

        serializer = LicenseTypeMasterSerializer(
            licence_type,
            data=request.data
        )

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)

        return Response(serializer.errors)

    elif request.method == 'DELETE':

        licence_type.delete()

        return Response(
            {"message": "Deleted Successfully"},
            status=status.HTTP_200_OK
        )

# endregion

# end of API FOR THE LICENCE TYPE MASTER

#---------------------------------------------------------------------------

# API for the Menu Master 

#startregion 

class MenuMasterViewSet(viewsets.ModelViewSet):
    queryset = MenuMaster.objects.filter(Is_Active=True)
    serializer_class = MenuMasterSerializer
    permission_classes = [IsAuthenticated, HasMenuPermission]
    menu_names = ("Staff List", "Add Staff")

#endregion

# End of Menu Master
