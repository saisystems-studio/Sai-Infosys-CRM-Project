export function applyRecordedPayment(payments, result) {
  if (result.remaining_balance === "0.00") {
    return payments.filter((payment) => payment.id !== result.id);
  }

  return payments.map((payment) =>
    payment.id === result.id
      ? {
          ...payment,
          total_paid: result.total_paid,
          remaining_balance: result.remaining_balance,
        }
      : payment,
  );
}
