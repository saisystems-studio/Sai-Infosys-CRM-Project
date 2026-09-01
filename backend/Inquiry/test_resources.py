from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework import serializers

from Inquiry.serializers import InquiryCreateSerializer, InquiryListSerializer


class InquiryResourceTests(SimpleTestCase):
    @patch("Inquiry.serializers.StaffDetails", create=True)
    def test_resource_validation_uses_active_staff_id(self, staff_details):
        staff_filter = staff_details.objects.filter
        staff_filter.return_value.exists.return_value = True

        value = InquiryCreateSerializer().validate_resource_id(7)

        self.assertEqual(value, 7)
        staff_filter.assert_called_once_with(pk=7, Is_Active=True)

    @patch("Inquiry.serializers.StaffDetails", create=True)
    def test_inactive_or_unknown_staff_resource_is_rejected(self, staff_details):
        staff_filter = staff_details.objects.filter
        staff_filter.return_value.exists.return_value = False

        with self.assertRaises(serializers.ValidationError):
            InquiryCreateSerializer().validate_resource_id(99)

    def test_resource_name_comes_from_staff_details(self):
        inquiry = SimpleNamespace(
            Resource_Id=SimpleNamespace(Full_Name="Priya"),
        )

        name = InquiryListSerializer().get_resource_name(inquiry)

        self.assertEqual(name, "Priya")
