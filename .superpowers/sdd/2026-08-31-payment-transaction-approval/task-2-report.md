# Task 2: Recalculate overall product status after transaction approval

## Changed files

- `backend/Inquiry/payment_ledger.py`
  - Added `approve_payment_detail`, which locks the target payment detail,
    records its approval metadata, refreshes the linked product status, and
    returns the approved `PaymentDetail`.
  - Added `refresh_product_payment_status`, which locks the product and marks
    it `Received` only when its two-decimal payment total equals its revenue
    amount and no detail remains pending approval; otherwise it marks it
    `Pending`.
- `backend/Inquiry/tests.py`
  - Added service tests for partial approval remaining pending and for the
    product becoming received only after the full balance and every detail
    approval are complete.

## Test-first record

The two service tests were added before production service code. The intended
RED command was:

```powershell
& 'backend\\venv\\Scripts\\python.exe' 'backend\\manage.py' test Inquiry.tests.PaymentApprovalAccessTests.test_approving_one_installment_does_not_complete_the_product Inquiry.tests.PaymentApprovalAccessTests.test_overall_status_changes_only_after_full_paid_balance_and_all_approvals -v 2
```

It could not start Django because the venv launcher is configured for an
inaccessible interpreter:

```text
did not find executable at 'C:\\Users\\Sai_Dev_3\\AppData\\Local\\Programs\\Python\\Python313\\python.exe': Access is denied.
```

The same command was retried after implementation for GREEN and was blocked by
the identical venv error. The system Python launcher also reported no installed
Python versions, so syntax or Django tests could not be run by another local
interpreter.

## Self-review

- Detail and product `select_for_update()` locking are inside atomic
  transactions, preventing concurrent approvals from deriving an inconsistent
  product status.
- Approval metadata is updated with explicit `update_fields`; a second service
  approval raises the planned validation error.
- The payment total and revenue comparison are quantized to two decimal places.
- Scope is limited to Task 2: no serializers, views, routes, or frontend files
  were changed.
- The workspace has no Git repository metadata, so Git diff checks could not
  run. No commit was created.
