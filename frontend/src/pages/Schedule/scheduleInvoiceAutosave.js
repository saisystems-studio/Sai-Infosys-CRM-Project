export const INVOICE_AUTOSAVE_DELAY_MS = 600;

export function buildInvoiceAmountPayload(invoiceAmount) {
  return { invoice_amount: invoiceAmount };
}

export function scheduleInvoiceAmountSave(save, value, delay) {
  const timer = setTimeout(() => save(value), delay);
  return () => clearTimeout(timer);
}
