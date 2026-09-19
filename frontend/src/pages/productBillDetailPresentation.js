export const buildProductBillDetailSummary = (billing) => ({
  customer: billing.customer_name || "Customer",
  company: billing.company_name || "-",
  product:
    billing.product_name ||
    billing.product_type_name ||
    billing.requirement ||
    "Product",
  billAmount: Number(billing.revenue_amount || 0),
  paidAmount: Number(billing.total_paid || 0),
  remainingAmount: Number(billing.remaining_balance || 0),
  billDate:
    billing.created_on ||
    billing.createdAt ||
    billing.Created_On ||
    billing.latest_payment_date ||
    "",
});
