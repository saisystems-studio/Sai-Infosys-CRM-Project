export function getPaymentPendingDefaults(inquiry) {
  const total = inquiry?.total;
  const amount = total == null || total === "" ? "" : String(total);

  return {
    invoiceAmount: amount,
    revenueAmount: amount,
  };
}

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

export function buildPaymentPendingPayload(invoiceAmount, revenueAmount, unpaidService = false) {
  if (unpaidService) {
    return {
      invoice_amount: 0,
      revenue_amount: 0,
      unpaid_service: true,
    };
  }

  return {
    invoice_amount: invoiceAmount,
    revenue_amount: revenueAmount,
  };
}

export function getPaymentPendingError(error, unpaidService = false) {
  const responseData = error?.response?.data;
  if (typeof responseData?.detail === "string") return responseData.detail;
  if (Array.isArray(responseData) && responseData.length) {
    return String(responseData[0]);
  }
  return unpaidService
    ? "Unable to complete this unpaid service."
    : "Unable to move this inquiry to Payment Pending.";
}
