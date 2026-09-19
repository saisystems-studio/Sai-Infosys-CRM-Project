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


class CustomerGSTValidationTests(TestCase):
    def test_optional_gst(self):
        for data in [{}, {"gst_number": ""}, {"gst_number": None}]:
            serializer = CustomerDetailsSerializer(data=data)
            self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_invalid_length(self):
        for value in ["12345", "1" * 16]:
            serializer = CustomerDetailsSerializer(data={"gst_number": value})
            self.assertFalse(serializer.is_valid())
            self.assertIn("gst_number", serializer.errors)

    def test_duplicate_and_unchanged_gst(self):
        customer = CustomerDetails.objects.create(
            customer_code="GST-TEST", gst_number="29ABCDE1234F1Z5",
            created_by=User.objects.create_user(username="gst-test-user"),
        )
        data = {"gst_number": " 29abcde1234f1z5 "}
        duplicate = CustomerDetailsSerializer(data=data)
        self.assertFalse(duplicate.is_valid())
        self.assertIn("already exists", str(duplicate.errors["gst_number"]))
        unchanged = CustomerDetailsSerializer(customer, data=data, partial=True)
        self.assertTrue(unchanged.is_valid(), unchanged.errors)
        self.assertEqual(unchanged.validated_data["gst_number"], customer.gst_number)


class CustomerIdentifierValidationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="identifier-test")
        self.customer = CustomerDetails.objects.create(
            customer_code="IDENT-1", created_by=self.user,
        )
        self.customer.contacts.create(contact_name="Contact", contact_number="9876543210", created_by=self.user)
        self.customer.licenses.create(tally_serial_number="TALLY123", created_by=self.user)

    def test_rejects_existing_contact_number(self):
        serializer = CustomerDetailsSerializer(data={
            "contacts": [{"contact_name": "Other", "contact_number": "9876543210"}],
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn("already exists", str(serializer.errors["contacts"]))

    def test_rejects_repeated_contact_numbers(self):
        row = {"contact_name": "New", "contact_number": "9123456780"}
        serializer = CustomerDetailsSerializer(data={"contacts": [row, row]})
        self.assertFalse(serializer.is_valid())
        self.assertIn("contacts", serializer.errors)

    def test_allows_duplicate_license_serial_numbers(self):
        serializer = CustomerDetailsSerializer(data={
            "licenses": [
                {"tally_serial_number": "TALLY123"},
                {"tally_serial_number": "TALLY123"},
            ],
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_allows_own_identifiers_and_blank_serials(self):
        serializer = CustomerDetailsSerializer(self.customer, data={
            "contacts": [{"contact_name": "Contact", "contact_number": "9876543210"}],
            "licenses": [{"tally_serial_number": "TALLY123"}, {"tally_serial_number": ""}, {"tally_serial_number": ""}],
        }, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)


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
