import json

from rest_framework import serializers
from django.contrib.auth.models import User

from .models import StaffDetails, StaffMenuPermission


# ============================================================
# Staff Menu Permission Serializer
# ============================================================

class StaffMenuPermissionSerializer(serializers.ModelSerializer):

    Menu_Name = serializers.CharField(
        source="Menu.Menu_Name",
        read_only=True
    )

    class Meta:
        model = StaffMenuPermission
        fields = [
            "Id",
            "Menu",
            "Menu_Name",
            "Can_View",
            "Can_Add",
            "Can_Edit",
            "Can_Delete",
        ]


# ============================================================
# Staff Details Serializer
# ============================================================

class StaffDetailsSerializer(serializers.ModelSerializer):

    # Login fields - not stored in StaffDetails table
    Username = serializers.CharField(
        write_only=True,
        required=False
    )

    Password = serializers.CharField(
        write_only=True,
        required=False,
        min_length=6
    )

    Confirm_Password = serializers.CharField(
        write_only=True,
        required=False
    )

    # Incoming raw JSON string from frontend FormData, e.g.
    # '[{"Menu_Id":1,"Can_View":true,"Can_Add":false,"Can_Edit":false,"Can_Delete":false}, ...]'
    Menu_Permissions = serializers.CharField(
        write_only=True,
        required=False,
        allow_blank=True
    )

    Username_Display = serializers.CharField(
        source="User_Id.username",
        read_only=True
    )

    # Renamed to avoid clashing with the write-only field above.
    # Used only when returning/reading staff data (GET requests).
    Menu_Permissions_Display = StaffMenuPermissionSerializer(
        source="MenuPermissions",
        many=True,
        read_only=True
    )

    class Meta:
        model = StaffDetails

        fields = [
            "Id",

            # Personal Details
            "Staff_Image",
            "Full_Name",
            "Designation",
            "Email_Address",
            "Phone_Number",

            # Employee Details
            "Hire_Date",
            "Role",
            "Is_Active",

            # Login Credentials
            "Username",
            "Password",
            "Confirm_Password",
            "Username_Display",

            # Menu Permission
            "Menu_Permissions",
            "Menu_Permissions_Display",

            # Audit
            "User_Id",
            "Created_By",
            "Created_On",
        ]

        read_only_fields = [
            "Id",
            "User_Id",
            "Username_Display",
            "Menu_Permissions_Display",
            "Created_By",
            "Created_On",
        ]

    # ========================================================
    # Validation
    # ========================================================

    def validate(self, attrs):

        password = attrs.get("Password")
        confirm_password = attrs.get("Confirm_Password")

        if password and password != confirm_password:
            raise serializers.ValidationError({
                "Confirm_Password": "Password and Confirm Password do not match."
            })

        username = attrs.get("Username")

        if username:
            if User.objects.filter(username=username).exists():
                raise serializers.ValidationError({
                    "Username": "Username already exists."
                })

        return attrs

    # ========================================================
    # Create Staff
    # ========================================================

    def create(self, validated_data):

        username = validated_data.pop("Username", None)
        password = validated_data.pop("Password", None)
        validated_data.pop("Confirm_Password", None)

        menu_permissions_raw = validated_data.pop("Menu_Permissions", None)

        request = self.context.get("request")

        # ----------------------------------------------------
        # Create Django User
        # ----------------------------------------------------

        if not username:
            raise serializers.ValidationError({
                "Username": "Username is required."
            })

        if not password:
            raise serializers.ValidationError({
                "Password": "Password is required."
            })

        user = User.objects.create_user(
            username=username,
            password=password,
            email=validated_data.get("Email_Address", "")
        )

        # ----------------------------------------------------
        # Created By
        # ----------------------------------------------------

        if request and request.user.is_authenticated:
            validated_data["Created_By"] = request.user

        # ----------------------------------------------------
        # Create Staff
        # ----------------------------------------------------

        staff = StaffDetails.objects.create(
            User_Id=user,
            **validated_data
        )

        # ----------------------------------------------------
        # Parse and Save Menu Permissions
        # ----------------------------------------------------

        if menu_permissions_raw:
            try:
                permissions_list = json.loads(menu_permissions_raw)
            except (TypeError, ValueError):
                permissions_list = []

            permission_objects = []

            for perm in permissions_list:
                menu_id = perm.get("Menu_Id")

                if not menu_id:
                    continue

                permission_objects.append(
                    StaffMenuPermission(
                        Staff=staff,
                        Menu_id=menu_id,
                        Can_View=bool(perm.get("Can_View", False)),
                        Can_Add=bool(perm.get("Can_Add", False)),
                        Can_Edit=bool(perm.get("Can_Edit", False)),
                        Can_Delete=bool(perm.get("Can_Delete", False)),
                    )
                )

            if permission_objects:
                StaffMenuPermission.objects.bulk_create(permission_objects)

        return staff

    # ========================================================
    # Update Staff (bonus: keeps edit-staff flow working too)
    # ========================================================

    def update(self, instance, validated_data):

        # Login fields aren't editable here — ignore if sent
        validated_data.pop("Username", None)
        validated_data.pop("Password", None)
        validated_data.pop("Confirm_Password", None)

        menu_permissions_raw = validated_data.pop("Menu_Permissions", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if menu_permissions_raw is not None:
            try:
                permissions_list = json.loads(menu_permissions_raw)
            except (TypeError, ValueError):
                permissions_list = []

            # Replace all existing permissions for this staff
            StaffMenuPermission.objects.filter(Staff=instance).delete()

            permission_objects = []
            for perm in permissions_list:
                menu_id = perm.get("Menu_Id")
                if not menu_id:
                    continue

                permission_objects.append(
                    StaffMenuPermission(
                        Staff=instance,
                        Menu_id=menu_id,
                        Can_View=bool(perm.get("Can_View", False)),
                        Can_Add=bool(perm.get("Can_Add", False)),
                        Can_Edit=bool(perm.get("Can_Edit", False)),
                        Can_Delete=bool(perm.get("Can_Delete", False)),
                    )
                )

            if permission_objects:
                StaffMenuPermission.objects.bulk_create(permission_objects)

        return instance