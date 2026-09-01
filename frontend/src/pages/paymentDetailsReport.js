const normalize = (value) => String(value || "").trim().toLowerCase();

export const getPaymentProduct = (payment) => payment?.product_name || payment?.requirement || "Product";
export const getPaymentCompany = (payment) => payment?.company_name || "Unassigned Company";

export function filterPaymentDetails(payments = [], filters = {}) {
  const search = normalize(filters.search);
  return payments.filter((payment) => {
    const paymentDate = String(payment.created_on || payment.payment_date || "").slice(0, 10);
    const searchable = [payment.customer_name, getPaymentCompany(payment), getPaymentProduct(payment)].map(normalize).join(" ");
    return (!search || searchable.includes(search)) &&
      (!filters.company || getPaymentCompany(payment) === filters.company) &&
      (!filters.product || getPaymentProduct(payment) === filters.product) &&
      (!filters.fromDate || paymentDate >= filters.fromDate) &&
      (!filters.toDate || paymentDate <= filters.toDate);
  });
}

export function getPaymentCardSummary(payment = {}) {
  return {
    product: getPaymentProduct(payment),
    company: getPaymentCompany(payment),
    paidAmount: Number(payment.amount || 0),
    revenueAmount: Number(payment.revenue_amount || 0),
  };
}
