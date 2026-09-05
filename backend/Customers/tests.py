from datetime import date, timedelta

from django.contrib.auth.models import User
from django.test import SimpleTestCase, TestCase

from .models import CustomerDetails
from .serializers import CustomerDetailsSerializer
from .serializers import CustomerLicenseDetailsSerializer


class CustomerLicenseDetailsSerializerTests(SimpleTestCase):
    def test_accepts_past_expiry_date(self):
        past_date = date.today() - timedelta(days=1)

        serializer = CustomerLicenseDetailsSerializer(
            data={"expiry_date": past_date.isoformat()},
        )

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertEqual(serializer.validated_data["expiry_date"], past_date)


class CustomerCodeAllocationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="customer-code-user")

    def create_customer(self, submitted_code):
        serializer = CustomerDetailsSerializer(
            data={
                "customer_code": submitted_code,
                "company_name": "Test Company",
            },
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        return serializer.save(created_by=self.user)

    def test_create_allocates_unique_codes_instead_of_trusting_browser_code(self):
        first = self.create_customer("CUST0001SAI")
        second = self.create_customer("CUST0001SAI")

        self.assertEqual(first.customer_code, "CUST0001SAI")
        self.assertEqual(second.customer_code, "CUST0002SAI")
        self.assertEqual(
            list(
                CustomerDetails.objects.order_by("id").values_list(
                    "customer_code",
                    flat=True,
                ),
            ),
            ["CUST0001SAI", "CUST0002SAI"],
        )
