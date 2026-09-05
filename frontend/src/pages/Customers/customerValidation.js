export function getRequiredCustomerErrors(customer) {
  const errors = {};

  if (!String(customer.company_name || "").trim()) {
    errors.company_name = "Company name is required";
  }
  if (!customer.customer_type) {
    errors.customer_type = "Customer type is required";
  }
  if (!String(customer.gst_number || "").trim()) {
    errors.gst_number = "GST number is required";
  } else if (customer.gst_number.length !== 15) {
    errors.gst_number = "GST number must be 15 characters";
  }

  return errors;
}
