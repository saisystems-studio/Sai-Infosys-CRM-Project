from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from django.test import TestCase

from Inquiry.serializers import InquiryCreateSerializer


class InquiryUpdateSerializerTests(TestCase):
    @patch("Inquiry.serializers.InquiryProductDetails_tbl")
    def test_update_replaces_products_and_updates_existing_inquiry(self, product_model):
        customer = MagicMock()
        inquiry = MagicMock()
        inquiry.pk = 42
        inquiry.inquiryproductdetails_tbl_set.all.return_value.delete.return_value = (1, {})
        request = SimpleNamespace(user=SimpleNamespace(pk=9))
        product = SimpleNamespace(pk=11)
        product_model.side_effect = lambda **values: SimpleNamespace(**values)
        serializer = InquiryCreateSerializer(context={"request": request})

        result = serializer.update(inquiry, {
            "customer_id": customer,
            "customer_rating_id": 3,
            "schedule_date": "2026-09-15",
            "resource_id": 6,
            "status_id": 4,
            "source_id": SimpleNamespace(pk=5),
            "products": [{
                "product": product,
                "qty": 2,
                "rate": 450,
                "requirement": "Migration",
            }],
        })

        self.assertIs(result, inquiry)
        self.assertIs(inquiry.Customer_Id, customer)
        self.assertEqual(inquiry.Shedule_Date, "2026-09-15")
        self.assertEqual(inquiry.Resource_Id_id, 6)
        self.assertEqual(inquiry.Status_Id_id, 4)
        self.assertEqual(inquiry.Source_Id_id, 5)
        inquiry.save.assert_called_once()
        inquiry.inquiryproductdetails_tbl_set.all.return_value.delete.assert_called_once()
        records = product_model.objects.bulk_create.call_args.args[0]
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].Inquiry_Id, inquiry)
        self.assertEqual(records[0].ProductType_Id, product)
        self.assertEqual(records[0].Amount, 900)
        self.assertEqual(records[0].Requirment, "Migration")
        self.assertEqual(customer.customer_rating_id, 3)
        customer.save.assert_called_once_with(update_fields=["customer_rating"])
