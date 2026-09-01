from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase

from Inquiry.serializers import InquiryListSerializer


class InquiryScheduleResourceTests(SimpleTestCase):
    @patch("Inquiry.serializers.StaffDetails.objects")
    def test_resource_name_uses_loaded_foreign_key_without_an_extra_query(self, staff_objects):
        staff_objects.filter.side_effect = AssertionError("unexpected staff lookup")
        inquiry = SimpleNamespace(
            Resource_Id=SimpleNamespace(Full_Name="Priya"),
        )

        self.assertEqual(
            InquiryListSerializer().get_resource_name(inquiry),
            "Priya",
        )

