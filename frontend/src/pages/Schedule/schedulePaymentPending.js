export function validateInvoiceAmount(value) {
  if (String(value).trim() === "") {
    return "Enter the invoice amount before continuing.";
  }

  if (Number(value) < 0) {
    return "Invoice amount cannot be negative.";
  }

  return "";
}

export function validateRevenueAmount(value) {
  if (String(value).trim() === "") {
    return "Enter the total revenue amount before continuing.";
  }

  if (Number(value) < 0) {
    return "Revenue amount cannot be negative.";
  }

  return "";
}

export function buildPaymentPendingPayload(invoiceAmount, revenueAmount) {
  return {
    invoice_amount: invoiceAmount,
    revenue_amount: revenueAmount,
  };
}
