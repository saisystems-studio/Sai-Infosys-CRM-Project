from datetime import datetime

from django.contrib.auth import get_user_model
from django.test import TestCase

from Inquiry.models import InquiryDetails_tbl, InquiryProductDetails_tbl, InquiryTaskProgress, ProductBilling, TaskStatus
from masters.models import MenuMaster
from staff.models import StaffDetails, StaffMenuPermission
from .test_product_billing import ProductBillingCustomerLookupTests


class SalesReportTests(TestCase):
    setUp = ProductBillingCustomerLookupTests.setUp

    def make_bill(self, **changes):
        values = dict(Customer_Id=self.customer, Product_Id=self.product,
                      Contact_Number="9876543210", Rate="2500", Quantity="3",
                      Amount="7500", GST="1350", Total_Paid="2000",
                      Created_By=get_user_model().objects.get(username="billing-admin"))
        values.update(changes)
        bill = ProductBilling.objects.create(**values)
        ProductBilling.objects.filter(pk=bill.pk).update(Created_On=datetime(2026, 9, 18, 23, 59))
        return bill

    def test_counts_bill_entries_and_returns_balances_including_tax(self):
        bill = self.make_bill()
        self.make_bill(Total_Paid="8850")
        response = self.client.get('/api/sales-report/', {'from_date': '2026-09-18', 'to_date': '2026-09-18'})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['cards'][0]['count'], 2)
        self.assertEqual(data['cards'][0]['amount'], '17700.00')
        self.assertEqual(data['cards'][0]['revenue_amount'], '10850.00')
        row = next(row for row in data['rows'] if row['id'] == bill.pk)
        self.assertEqual(row['paid_amount'], '2000.00')
        self.assertEqual(row['remaining_amount'], '6850.00')
        self.assertEqual(row['company_name'], self.customer.company_name)

    def test_filters_and_validation(self):
        bill = self.make_bill()
        for params in ({'from_date': '2026-09-19'}, {'product_id': '99999'}, {'resource_id': '99999'}):
            response = self.client.get('/api/sales-report/', params)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['rows'], [])
            self.assertEqual(response.json()['cards'], [])
        response = self.client.get('/api/sales-report/', {'resource_id': bill.Created_By_id, 'product_id': bill.Product_Id_id})
        self.assertEqual(len(response.json()['rows']), 1)
        for params in ({'from_date': '2026-02-30'}, {'product_id': 'bad'}, {'from_date': '2026-10-01', 'to_date': '2026-09-01'}):
            self.assertEqual(self.client.get('/api/sales-report/', params).status_code, 400)

    def test_counts_completed_unpaid_and_amc_services(self):
        user = get_user_model().objects.get(username="billing-admin")
        resource = StaffDetails.objects.get(User_Id=user)
        inquiry = InquiryDetails_tbl.objects.create(
            Customer_Id=self.customer,
            Shedule_Date=datetime(2026, 9, 18).date(),
            Resource_Id=resource,
            Created_Id=user,
        )
        for is_amc in (False, True):
            InquiryProductDetails_tbl.objects.create(
                Inquiry_Id=inquiry,
                ProductType_Id=self.product,
                Quantity=1,
                Rate=0,
                Amount=0,
                Payment_Status="Not Required",
                Is_AMC=is_amc,
                Created_By=user,
            )
        InquiryTaskProgress.objects.create(
            Inquiry_Id=inquiry,
            Resource_Id=resource,
            Work_Date=datetime(2026, 9, 18).date(),
            Start_Time=datetime(2026, 9, 18, 10, 0),
            End_Time=datetime(2026, 9, 18, 11, 0),
            Task_Status=TaskStatus.PROGRESS_SAVED,
            Created_By=user,
        )

        response = self.client.get('/api/sales-report/', {
            'from_date': '2026-09-18',
            'to_date': '2026-09-18',
            'resource_id': user.id,
            'product_id': self.product.Id,
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['service_counts'], {'unpaid_service': 1, 'amc': 1})

    def test_requires_sales_report_permission(self):
        bill = self.make_bill()
        staff = StaffDetails.objects.get(User_Id=bill.Created_By)
        staff.Role = 'Staff'
        staff.save(update_fields=['Role'])
        self.client.force_authenticate(user=get_user_model().objects.get(pk=bill.Created_By_id))
        self.assertEqual(self.client.get('/api/sales-report/').status_code, 403)
        menu, _ = MenuMaster.objects.get_or_create(Menu_Name='Sales report')
        StaffMenuPermission.objects.create(Staff=staff, Menu=menu, Can_View=True)
        self.assertEqual(self.client.get('/api/sales-report/').status_code, 200)
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get('/api/sales-report/').status_code, 401)
