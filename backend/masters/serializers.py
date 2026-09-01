from rest_framework import serializers
from .models import ProductTypeMaster
from .models import CustomerTypeMaster
from .models import StatusTypeMaster
from .models import SourceTypeMaster
from .models import RatingTypeMaster
from .models import LicenseTypeMaster
from .models import MenuMaster

# Serializer for Product Type Master

class ProductTypeMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductTypeMaster
        fields = '__all__'

# Serializer for Customer Type Master

class CustomerTypeMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerTypeMaster
        fields = '__all__'

# Serializer for Status Type Master

class StatusTypeMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = StatusTypeMaster
        fields = '__all__'

# Serializer for Source Type Master

class SourceTypeMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = SourceTypeMaster
        fields = '__all__'

# Serializer for Rating Type Master

class RatingTypeMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = RatingTypeMaster
        fields = '__all__'

# Serializer for License Type Master

class LicenseTypeMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = LicenseTypeMaster
        fields = '__all__'

# Serializer for Menu Master

class MenuMasterSerializer(serializers.ModelSerializer):
    parent_id = serializers.IntegerField(
        source="Parent_Id_id",
        allow_null=True,
        required=False
    )

    class Meta:
        model = MenuMaster
        fields = [
            "Id",
            "Menu_Name",
            "Icon",
            "parent_id",
            "Display_Order",
            "Is_Active",
        ]