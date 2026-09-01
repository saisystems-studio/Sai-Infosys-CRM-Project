export function markPaymentReceivedInList(payments, id) {
  return payments.map((payment) =>
    payment.id === id
      ? { ...payment, approval_status: "Received" }
      : payment,
  );
}
