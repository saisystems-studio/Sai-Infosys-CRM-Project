export function createCustomerSavedHandler(navigate) {
  return () => navigate("Customer List");
}

export function createCustomerUpdatedHandler(refreshCustomers) {
  return () => refreshCustomers?.();
}
