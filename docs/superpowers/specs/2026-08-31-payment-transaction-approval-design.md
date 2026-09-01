# Payment Transaction Approval Design

## Goal

Track Super Admin verification for every payment recorded against an inquiry
product. A product's overall payment status becomes `Received` only when its
full revenue amount is recorded and every recorded payment is verified.

## Data model

Extend `PaymentDetail` with transaction-level approval fields:

- `Approval_Status`: `Pending` or `Received`, defaulting to `Pending`.
- `Approved_By`: nullable user reference, set only by Super Admin approval.
- `Approved_On`: nullable timestamp, set only by Super Admin approval.

`InquiryProductDetails_tbl.Payment_Status` remains the overall status for the
product. It is independent of any individual payment entry.

The migration preserves historical completed data: payment-detail rows linked
to products already marked `Received` are initialized as `Received`; all other
existing payment-detail rows are initialized as `Pending`.

## Workflow

1. Admin records a full payment or installment in Payment Pending.
2. The system creates an immutable `PaymentDetail` row with approval status
   `Pending` and recalculates the product's total paid and remaining balance.
3. Payment Approval displays one row for every `PaymentDetail`, including that
   row's amount, payment type/date, transaction approval status, and the
   product's current total/remaining amounts.
4. Super Admin marks an individual pending transaction `Received`. The action
   records the approver and approval time and cannot be repeated.
5. After every recorded payment is verified and the product's remaining
   balance is zero, the product's overall `Payment_Status` becomes `Received`.
   Otherwise it remains `Pending`.

For example, recording ₹2,500 and ₹500 creates two Pending approval rows.
Super Admin can approve ₹2,500 while ₹500 remains Pending. The product remains
Pending until all amounts due have been recorded and all recorded rows are
approved.

## Authorization and UI

- Admin can view Payment Pending and record payments, but cannot approve them.
- Super Admin can view Payment Pending in read-only mode, with no Paid button.
- Admin and Super Admin can view Payment Approval.
- Only Super Admin sees the Received button, once per pending payment
  transaction. Admin always sees a status badge.

The payment-approval action identifies a `PaymentDetail` row, rather than an
inquiry product. The table keeps one row per transaction, so installments are
never collapsed into a summary row.

## Backend API behavior

- Payment Pending GET returns outstanding products for both Admin and Super
  Admin, with a flag indicating whether the caller may record a payment.
- Payment Pending POST remains Admin-only and creates a Pending approval row.
- Payment Approvals GET returns every payment-detail row with product summary
  fields and transaction approval fields.
- Payment Approval Received POST is Super-Admin-only and targets a payment
  detail ID. It rejects already-approved rows and updates the product's
  overall status by recalculating the transaction and balance conditions.

## Error handling and testing

The API returns 403 for role violations, 404 for a missing payment row, and a
validation error for duplicate approval. Approval updates run in a transaction
with row locking so concurrent approvals cannot produce an incorrect product
status.

Tests cover pending creation, per-transaction approval, duplicate denial,
Admin approval denial, Super Admin entry denial, and the overall status change
only after both full payment and all transaction approvals. Frontend tests
cover role visibility and the separate transaction status rendering.
