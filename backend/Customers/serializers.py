from rest_framework import serializers
from .models import (
    CustomerDetails,
    CustomerContact,
    CustomerLicenseDetails
)
from masters.models import CustomerTypeMaster, RatingTypeMaster, LicenseTypeMaster
from django.contrib.auth.models import User
from datetime import date

class CustomerContactSerializer(serializers.ModelSerializer):
    contact_name = serializers.CharField(max_length=250, required=True)
    contact_number = serializers.CharField(max_length=20, required=True)
    
    class Meta:
        model = CustomerContact
        exclude = ['customer', 'created_by', 'created_on']
        
    def validate_contact_number(self, value):
        # Add phone number validation if needed
        if not value or len(value) < 10:
            raise serializers.ValidationError("Contact number must be at least 10 digits")
        return value


class CustomerLicenseDetailsSerializer(serializers.ModelSerializer):
    expiry_date = serializers.DateField(required=False, allow_null=True)
    
    class Meta:
        model = CustomerLicenseDetails
        exclude = ['customer', 'created_by', 'created_on']
        
    def validate_expiry_date(self, value):
        if value and value < date.today():
            raise serializers.ValidationError("Expiry date cannot be in the past")
        return value


class CustomerDetailsSerializer(serializers.ModelSerializer):
    contacts = CustomerContactSerializer(many=True, required=False)
    licenses = CustomerLicenseDetailsSerializer(many=True, required=False)
    contact_number = serializers.SerializerMethodField()
    
    # Read-only fields that should not be updated via API
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    created_on = serializers.DateTimeField(read_only=True)
    customer_code = serializers.CharField(max_length=50, required=True)
    customer_name = serializers.CharField(max_length=500, required=True)
    
    class Meta:
        model = CustomerDetails
        fields = [
            field.name for field in CustomerDetails._meta.fields
        ] + ["contacts", "licenses", "contact_number"]
        read_only_fields = ['id', 'created_by', 'created_on']

    def get_contact_number(self, obj):
        contact = obj.contacts.first()
        return contact.contact_number if contact else ""

    def validate_customer_code(self, value):
        # Check if customer code already exists (except for updates)
        instance = self.instance
        if CustomerDetails.objects.filter(customer_code=value).exclude(pk=instance.pk if instance else None).exists():
            raise serializers.ValidationError("Customer code already exists")
        return value

    def validate(self, data):
        # Add any cross-field validation here
        return data

    def create(self, validated_data):
        contacts_data = validated_data.pop('contacts', [])
        licenses_data = validated_data.pop('licenses', [])
        
        # Get current user from context
        request = self.context.get('request')
        if request and request.user:
            validated_data['created_by'] = request.user
        
        customer = CustomerDetails.objects.create(**validated_data)
        
        # Create contacts
        for contact_data in contacts_data:
            CustomerContact.objects.create(
                customer=customer,
                created_by=request.user if request else None,
                **contact_data
            )
        
        # Create licenses
        for license_data in licenses_data:
            CustomerLicenseDetails.objects.create(
                customer=customer,
                created_by=request.user if request else None,
                **license_data
            )
        
        return customer

    def update(self, instance, validated_data):
        contacts_data = validated_data.pop('contacts', [])
        licenses_data = validated_data.pop('licenses', [])
        
        # Update customer fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Handle contacts - replace all contacts (you might want to implement partial update)
        if contacts_data is not None:
            # Delete existing contacts
            instance.contacts.all().delete()
            # Create new contacts
            request = self.context.get('request')
            for contact_data in contacts_data:
                CustomerContact.objects.create(
                    customer=instance,
                    created_by=request.user if request else None,
                    **contact_data
                )
        
        # Handle licenses - replace all licenses
        if licenses_data is not None:
            # Delete existing licenses
            instance.licenses.all().delete()
            # Create new licenses
            request = self.context.get('request')
            for license_data in licenses_data:
                CustomerLicenseDetails.objects.create(
                    customer=instance,
                    created_by=request.user if request else None,
                    **license_data
                )
        
        return instance