# Payment Transaction Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Super Admin verify every recorded payment transaction independently while retaining a separate overall product payment status.

**Architecture:** Add approval fields to the existing `PaymentDetail` ledger rather than introducing a second table. Payment Pending keeps recording payments; Payment Approval operates on payment-detail IDs. A locked service recalculates the product status after each transaction approval, setting it to `Received` only when the balance is zero and no payment details remain unapproved.

**Tech Stack:** Django, Django REST Framework, Django migrations, React, Vite, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-31-payment-transaction-approval-design.md`

## Global Constraints

- A `PaymentDetail` is immutable for amount and type; only Super Admin verification fields may change.
- New payment details default to approval status `Pending`.
- Admin records payments; Super Admin can view Payment Pending but cannot record payments.
- Admin and Super Admin can view Payment Approval; only Super Admin can approve a transaction.
- Overall product `Payment_Status` is `Received` only if remaining balance is exactly zero and every payment detail is approved.
- Use `Decimal` with two decimal places for every payment calculation.
- Django tests are blocked until `backend/venv` is repaired; frontend checks run with `npm.cmd`.

---

## File Structure

- `backend/Inquiry/models.py` — owns transaction approval fields and statuses.
- `backend/Inquiry/migrations/0008_paymentdetail_approval.py` — adds fields and migrates existing ledger data.
- `backend/Inquiry/payment_ledger.py` — recalculates the overall product status under lock.
- `backend/Inquiry/serializers.py` — serializes transaction approval fields.
- `backend/Inquiry/views.py` — exposes Super Admin approval by payment-detail ID and returns per-transaction statuses.
- `backend/Inquiry/tests.py` — service and API authorization/status regression coverage.
- `frontend/src/pages/PaymentPending.jsx` — hides payment-entry controls from Super Admin.
- `frontend/src/pages/PaymentApproval.jsx` — renders and approves individual transaction rows.
- `frontend/src/pages/paymentApprovalState.js` — updates a single transaction’s status in UI state.
- `frontend/src/pages/paymentApprovalState.test.js` — tests the state update helper.
- `frontend/src/pages/paymentApprovalAccess.js` and `.test.js` — owns payment-entry role checks.
- `frontend/src/pages/Dashboard.jsx` — keeps Payment Pending visible to both roles.

### Task 1: Add transaction approval fields and migrate existing rows

**Files:**
- Modify: `backend/Inquiry/models.py`
- Create: `backend/Inquiry/migrations/0008_paymentdetail_approval.py`
- Modify: `backend/Inquiry/tests.py`

**Interfaces:**
- Produces: `PaymentDetail.Approval_Status`, `Approved_By`, and `Approved_On`.
- Consumed by: `approve_payment_detail` and `PaymentApprovalEntrySerializer`.

- [ ] **Step 1: Write the failing model test**

```python
def test_new_payment_detail_starts_pending_approval(self):
    detail = PaymentDetail.objects.create(
        Inquiry_Product=self.pending_payment,
        Amount=Decimal("4.00"),
        Payment_Type=PaymentDetail.PaymentType.INSTALLMENT,
        Created_By=self.admin_user,
    )

    self.assertEqual(detail.Approval_Status, "Pending")
    self.assertIsNone(detail.Approved_By)
    self.assertIsNone(detail.Approved_On)
```

- [ ] **Step 2: Run the focused test to observe RED**

Run: `backend/venv/Scripts/python.exe backend/manage.py test Inquiry.tests.PaymentApprovalAccessTests.test_new_payment_detail_starts_pending_approval -v 2`

Expected: failure because `Approval_Status` does not exist; if the known Python runtime error occurs, record it and continue.

- [ ] **Step 3: Add model fields and migration**

```python
class PaymentApprovalStatus(models.TextChoices):
    PENDING = "Pending", "Pending"
    RECEIVED = "Received", "Received"

Approval_Status = models.CharField(
    max_length=20,
    choices=PaymentApprovalStatus.choices,
    default=PaymentApprovalStatus.PENDING,
    db_column="Approval_Status",
)
Approved_By = models.ForeignKey(
    User, null=True, blank=True, on_delete=models.PROTECT,
    related_name="approved_payment_details", db_column="Approved_By",
)
Approved_On = models.DateTimeField(null=True, blank=True, db_column="Approved_On")
```

Create a schema migration, then a `RunPython` data migration that marks a
payment detail `Received` only when its linked product already has
`Payment_Status="Received"`; leave all other historical details `Pending`.

- [ ] **Step 4: Run the focused test to observe GREEN**

Run: `backend/venv/Scripts/python.exe backend/manage.py test Inquiry.tests.PaymentApprovalAccessTests.test_new_payment_detail_starts_pending_approval -v 2`

Expected: PASS once the Django runtime is repaired.

### Task 2: Recalculate overall product status after transaction approval

**Files:**
- Modify: `backend/Inquiry/payment_ledger.py`
- Modify: `backend/Inquiry/tests.py`

**Interfaces:**
- Produces: `approve_payment_detail(*, payment_detail_id, user) -> PaymentDetail`.
- Produces: `refresh_product_payment_status(product) -> InquiryProductDetails_tbl`.
- Consumed by: the payment-approval received API action.

- [ ] **Step 1: Write failing service tests**

```python
def test_approving_one_installment_does_not_complete_the_product(self):
    first = PaymentDetail.objects.create(
        Inquiry_Product=self.pending_payment, Amount=Decimal("4.00"),
        Payment_Type="installment", Created_By=self.admin_user,
    )

    approve_payment_detail(payment_detail_id=first.pk, user=self.super_admin_user)

    first.refresh_from_db()
    self.pending_payment.refresh_from_db()
    self.assertEqual(first.Approval_Status, "Received")
    self.assertEqual(self.pending_payment.Payment_Status, "Pending")

def test_overall_status_changes_only_after_full_paid_balance_and_all_approvals(self):
    first = PaymentDetail.objects.create(
        Inquiry_Product=self.pending_payment, Amount=Decimal("4.00"),
        Payment_Type="installment", Created_By=self.admin_user,
    )
    second = PaymentDetail.objects.create(
        Inquiry_Product=self.pending_payment, Amount=Decimal("6.00"),
        Payment_Type="installment", Created_By=self.admin_user,
    )

    approve_payment_detail(payment_detail_id=first.pk, user=self.super_admin_user)
    self.pending_payment.refresh_from_db()
    self.assertEqual(self.pending_payment.Payment_Status, "Pending")

    approve_payment_detail(payment_detail_id=second.pk, user=self.super_admin_user)
    self.pending_payment.refresh_from_db()
    self.assertEqual(self.pending_payment.Payment_Status, "Received")
```

- [ ] **Step 2: Run the service tests to observe RED**

Run: `backend/venv/Scripts/python.exe backend/manage.py test Inquiry.tests.PaymentApprovalAccessTests -v 2`

Expected: failure because `approve_payment_detail` does not exist, subject to the known runtime blocker.

- [ ] **Step 3: Implement locked approval and status refresh**

```python
@transaction.atomic
def approve_payment_detail(*, payment_detail_id, user):
    detail = PaymentDetail.objects.select_for_update().select_related(
        "Inquiry_Product"
    ).get(pk=payment_detail_id)
    if detail.Approval_Status == PaymentDetail.PaymentApprovalStatus.RECEIVED:
        raise ValidationError({"detail": "Payment has already been received."})
    detail.Approval_Status = PaymentDetail.PaymentApprovalStatus.RECEIVED
    detail.Approved_By = user
    detail.Approved_On = timezone.now()
    detail.save(update_fields=["Approval_Status", "Approved_By", "Approved_On"])
    return refresh_product_payment_status(detail.Inquiry_Product)
```

`refresh_product_payment_status` must lock the product, calculate the sum of
payment amounts, check for any `Approval_Status="Pending"` detail, and save
`Payment_Status="Received"` only if total paid equals `Revenue_Amount` and no
pending approval remains; otherwise save `Pending`.

- [ ] **Step 4: Run the focused service tests to observe GREEN**

Run: `backend/venv/Scripts/python.exe backend/manage.py test Inquiry.tests.PaymentApprovalAccessTests -v 2`

Expected: PASS once Django can start.

### Task 3: Replace product-level approval API with transaction-level approval API

**Files:**
- Modify: `backend/Inquiry/serializers.py`
- Modify: `backend/Inquiry/views.py`
- Modify: `backend/Inquiry/tests.py`

**Interfaces:**
- Produces: `POST /api/inquiries/payment-approvals/<payment_detail_id>/received/`.
- Produces: approval list entries with `approval_status`, `approved_by`, and `approved_on`.
- Consumes: `approve_payment_detail`.

- [ ] **Step 1: Write failing API tests**

```python
def test_super_admin_approves_one_payment_transaction(self):
    detail = PaymentDetail.objects.create(
        Inquiry_Product=self.pending_payment, Amount=Decimal("4.00"),
        Payment_Type="installment", Created_By=self.admin_user,
    )
    self.client.force_authenticate(self.super_admin_user)

    response = self.client.post(
        f"/api/inquiries/payment-approvals/{detail.pk}/received/"
    )

    self.assertEqual(response.status_code, 200)
    detail.refresh_from_db()
    self.assertEqual(detail.Approval_Status, "Received")

def test_admin_cannot_approve_a_payment_transaction(self):
    detail = PaymentDetail.objects.create(
        Inquiry_Product=self.pending_payment, Amount=Decimal("4.00"),
        Payment_Type="installment", Created_By=self.admin_user,
    )

    response = self.client.post(
        f"/api/inquiries/payment-approvals/{detail.pk}/received/"
    )

    self.assertEqual(response.status_code, 403)
```

- [ ] **Step 2: Run the API tests to observe RED**

Run: `backend/venv/Scripts/python.exe backend/manage.py test Inquiry.tests.PaymentApprovalAccessTests -v 2`

Expected: failure because the action currently interprets the ID as a product ID.

- [ ] **Step 3: Update serializer and view action**

Add these serializer fields to `PaymentApprovalEntrySerializer`:

```python
approval_status = serializers.CharField(source="Approval_Status", read_only=True)
approved_by = serializers.CharField(source="Approved_By.username", read_only=True, allow_null=True)
approved_on = serializers.DateTimeField(source="Approved_On", read_only=True, allow_null=True)
```

Replace the product-level `payment_received` body with a Super-Admin-only call
to `approve_payment_detail(payment_detail_id=payment_detail_id, user=request.user)`.
Return the updated detail ID, transaction approval status, and recalculated
overall payment status. Remove the zero-balance restriction: every individual
transaction can be approved, but the overall status remains derived by the
service.

- [ ] **Step 4: Run the API tests to observe GREEN**

Run: `backend/venv/Scripts/python.exe backend/manage.py test Inquiry.tests.PaymentApprovalAccessTests -v 2`

Expected: PASS once Django is available.

### Task 4: Enforce read-only Super Admin Payment Pending access

**Files:**
- Modify: `backend/Inquiry/serializers.py`
- Modify: `backend/Inquiry/views.py`
- Modify: `backend/Inquiry/tests.py`
- Modify: `frontend/src/pages/paymentApprovalAccess.js`
- Modify: `frontend/src/pages/paymentApprovalAccess.test.js`
- Modify: `frontend/src/pages/Dashboard.jsx`
- Modify: `frontend/src/pages/PaymentPending.jsx`

**Interfaces:**
- Produces: `canRecordPayment(user) -> boolean` where only Admin returns true.
- Produces: pending-list responses containing `can_record_payment`.

- [ ] **Step 1: Write failing access tests**

```javascript
test("Super Admin can view Payment Pending but cannot record a payment", () => {
  assert.equal(canViewPaymentApproval({ role: "Super Admin" }), true);
  assert.equal(canRecordPayment({ role: "Super Admin" }), false);
});
```

```python
def test_super_admin_can_view_but_cannot_record_pending_payments(self):
    self.client.force_authenticate(self.super_admin_user)
    self.assertEqual(self.client.get("/api/inquiries/payment-pending/").status_code, 200)
    response = self.client.post(
        f"/api/inquiries/payment-pending/{self.pending_payment.pk}/paid/",
        {"amount": "4.00", "payment_type": "installment"}, format="json",
    )
    self.assertEqual(response.status_code, 403)
```

- [ ] **Step 2: Run tests to observe RED**

Run: `npm.cmd test -- paymentApprovalAccess.test.js`

Expected: failure until the Super Admin pending-page visibility is restored.

Run: `backend/venv/Scripts/python.exe backend/manage.py test Inquiry.tests.PaymentApprovalAccessTests -v 2`

Expected: backend runtime blocker or a role-status failure before the endpoint is updated.

- [ ] **Step 3: Implement read-only UI and API data**

Keep `payment_pending` GET authorization for Admin and Super Admin; keep
`payment_paid` POST protected by `_require_admin`. Make the Dashboard show
Payment Pending for `canViewPaymentApproval(user)`, not `canRecordPayment`.
Pass `canRecordPayment(user)` to `PaymentPending`; when false, omit the Action
column and the Paid modal trigger. Include `can_record_payment` in the GET
response if the component needs server-confirmed access.

- [ ] **Step 4: Run role tests to observe GREEN**

Run: `npm.cmd test -- paymentApprovalAccess.test.js`

Expected: PASS.

### Task 5: Render and update per-transaction approval statuses

**Files:**
- Modify: `frontend/src/pages/PaymentApproval.jsx`
- Modify: `frontend/src/pages/paymentApprovalState.js`
- Modify: `frontend/src/pages/paymentApprovalState.test.js`
- Modify: `frontend/src/pages/PaymentApproval.css`

**Interfaces:**
- Consumes: approval API rows with `id`, `product_id`, `approval_status`, and `payment_status`.
- Produces: `markPaymentReceivedInList(rows, detailId, approvedBy, approvedOn)`.

- [ ] **Step 1: Write the failing UI-state test**

```javascript
test("marking one transaction received does not change other installments", () => {
  const rows = [
    { id: 10, approval_status: "Pending" },
    { id: 11, approval_status: "Pending" },
  ];

  assert.deepEqual(markPaymentReceivedInList(rows, 10), [
    { id: 10, approval_status: "Received" },
    { id: 11, approval_status: "Pending" },
  ]);
});
```

- [ ] **Step 2: Run the test to observe RED**

Run: `npm.cmd test -- paymentApprovalState.test.js`

Expected: failure because the existing helper updates product status by product ID.

- [ ] **Step 3: Update helper and Approval table**

```javascript
export function markPaymentReceivedInList(rows, detailId) {
  return rows.map((row) =>
    row.id === detailId ? { ...row, approval_status: "Received" } : row,
  );
}
```

In `PaymentApproval.jsx`, show `approval_status` in the status column. Super
Admin gets a Received button for every row with `approval_status === "Pending"`;
its click uses `payment.id`, not `payment.product_id`. Admin sees badges only.
Reload the list after a successful approval so overall product status is fresh.

- [ ] **Step 4: Run frontend verification**

Run: `npm.cmd test -- paymentApprovalState.test.js`

Expected: PASS.

Run: `npm.cmd run build`

Expected: Vite exits with status 0.

## Self-Review

- Spec coverage: Tasks 1–2 add and derive transaction/overall status; Task 3 exposes secure transaction approval; Task 4 grants Super Admin read-only pending-page access; Task 5 renders one independently approvable row per payment.
- Placeholder scan: no deferred actions or unspecified interfaces remain.
- Type consistency: transaction approval uses `PaymentDetail.pk` throughout, while all product-level balance calculations retain `InquiryProductDetails_tbl` IDs.
