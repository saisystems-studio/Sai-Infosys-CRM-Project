const stringValue = (value) =>
  value === null || value === undefined ? "" : String(value);

export function createInquiryEditState(inquiry) {
  const inquiryId = inquiry?.id ?? inquiry?.Id ?? "";
  const products = inquiry?.products ?? inquiry?.inquiry_products ?? [];

  return {
    inquiryId: stringValue(inquiryId),
    phone: stringValue(inquiry?.phone_number ?? inquiry?.phone),
    customerId: stringValue(inquiry?.Customer_Id ?? inquiry?.customer_id),
    customer: {
      name: inquiry?.customer_name ?? "",
      email: inquiry?.email_id ?? "",
      serial: inquiry?.tally_serial_number ?? "",
      expiry: inquiry?.expiry_date ?? "",
    },
    rating: stringValue(
      inquiry?.rating_id ?? inquiry?.customer_rating_id,
    ),
    schedule: stringValue(inquiry?.schedule_date ?? inquiry?.Shedule_Date),
    resource: stringValue(inquiry?.Resource_Id ?? inquiry?.resource_id),
    source: stringValue(inquiry?.Source_Id ?? inquiry?.source_id),
    status: stringValue(inquiry?.Status_Id ?? inquiry?.status_id),
    items: products.map((product, index) => ({
      id: `inquiry-product-${inquiryId}-${index}`,
      product: stringValue(product?.product ?? product?.ProductType_Id),
      quantity: stringValue(product?.qty ?? product?.Quantity ?? 1),
      rate: stringValue(product?.rate ?? product?.Rate),
      requirement:
        product?.requirement ?? product?.Requirment ?? product?.remarks ?? "",
    })),
  };
}

