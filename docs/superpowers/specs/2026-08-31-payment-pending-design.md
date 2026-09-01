# Payment Pending Ledger Design

## Goal

Add a separate Payment Pending page where Admin and Super Admin users can
record full or installment payments and track outstanding balances.

## Data model

Create a payment-detail record linked to `InquiryProductDetails_tbl`. Each
row represents one received payment and stores:

- payment amount
- payment type: `full` or `installment`
- payment date/time
- user who recorded the payment
- creation timestamp

The existing product `Revenue_Amount` remains the total amount due. The
amount already paid is the sum of its payment-detail records, and the
remaining balance is `Revenue_Amount - total paid`.

## Backend behavior

- Add a Payment Pending list endpoint for Admin and Super Admin users. It
  returns revenue products with a remaining balance greater than zero,
  including total due, total paid, and remaining balance.
- Add a payment-recording endpoint available to both Admin and Super Admin.
  It creates a payment-detail record inside a transaction and locks the
  product row while calculating its balance.
- A payment amount must be positive and cannot exceed the remaining balance.
- A `full` payment must exactly equal the remaining balance. An
  `installment` can be any valid positive amount up to that balance.
- When the remaining balance reaches zero, set the product payment status to
  `Received`; otherwise retain `Pending`.
- Invalid transitions, missing products, overpayments, and unauthorized
  requests return explicit validation or permission errors.

## Frontend behavior

- Add Payment Pending as a separate dashboard menu and page for Admin and
  Super Admin users.
- Reuse the payment-approval table columns, plus paid amount and remaining
  balance.
- Each outstanding row has a Paid button. It opens a modal that displays the
  balance, accepts the payment amount, and provides Full Payment / Installment
  radio options.
- On success, update the row using the API response. Fully paid rows leave
  the pending list; installment rows show the reduced balance.

## Authorization

Both Admin and Super Admin can view the Payment Pending page and record
payments. Existing Payment Approval permissions remain unchanged.

## Testing

- Backend tests: full payment, installment payment, overpayment rejection,
  full-payment amount validation, completed-payment exclusion, and role
  permissions.
- Frontend tests: payment type selection and list-state updates after a full
  payment or installment.
- Run the frontend test suite and production build. Django tests require a
  repaired Python environment because the current project virtual environment
  references an unavailable Python 3.13 executable.
