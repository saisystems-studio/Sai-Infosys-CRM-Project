from rest_framework import serializers
from .models import (
    CustomerDetails,
    CustomerContact,
    CustomerLicenseDetails
)
from masters.models import CustomerTypeMaster, RatingTypeMaster, LicenseTypeMaster
from django.contrib.auth.models import User
from django.db import transaction

from .customer_codes import allocate_customer_code

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
        
class CustomerDetailsSerializer(serializers.ModelSerializer):
    contacts = CustomerContactSerializer(many=True, required=False)
    licenses = CustomerLicenseDetailsSerializer(many=True, required=False)
    contact_number = serializers.SerializerMethodField()
    
    # Read-only fields that should not be updated via API
    created_by = serializers.PrimaryKeyRelatedField(read_only=True)
    created_on = serializers.DateTimeField(read_only=True)
    customer_code = serializers.CharField(read_only=True)
    customer_name = serializers.CharField(
        max_length=500,
        required=False,
        allow_null=True,
        allow_blank=True,
    )
    
    class Meta:
        model = CustomerDetails
        fields = [
            field.name for field in CustomerDetails._meta.fields
        ] + ["contacts", "licenses", "contact_number"]
        read_only_fields = ['id', 'created_by', 'created_on']

    def get_contact_number(self, obj):
        contact = obj.contacts.first()
        return contact.contact_number if contact else ""

    def validate(self, data):
        # Add any cross-field validation here
        return data

    @transaction.atomic
    def create(self, validated_data):
        contacts_data = validated_data.pop('contacts', [])
        licenses_data = validated_data.pop('licenses', [])
        validated_data['customer_code'] = allocate_customer_code()
        
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
