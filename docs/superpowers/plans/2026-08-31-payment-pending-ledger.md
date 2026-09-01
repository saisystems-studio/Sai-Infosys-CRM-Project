# Payment Pending Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate Payment Pending page that lets Admin and Super Admin record full or installment payments while retaining a payment audit trail and accurate outstanding balances.

**Architecture:** Introduce an immutable `PaymentDetail` ledger model linked to each inquiry product. A payment service will lock the product, calculate the existing paid total, validate the requested payment, create the ledger row, and update the product status only when the balance reaches zero. A separate API and React page will expose outstanding products and a Paid modal.

**Tech Stack:** Django, Django REST Framework, Django migrations, React, Vite, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-31-payment-pending-design.md`

## Global Constraints

- Both Admin and Super Admin can view and record Payment Pending payments.
- `PaymentDetail` rows are append-only audit records; never overwrite earlier payments.
- All money uses `Decimal` with two decimal places; reject payments less than or equal to zero and payments above the remaining balance.
- Full Payment must equal the remaining balance; Installment may be any valid positive amount up to the balance.
- A product becomes `Received` only when its remaining balance is zero; otherwise it remains `Pending`.
- The existing Payment Approval workflow and its Super Admin-only Received action must remain unchanged.
- Django test execution is currently blocked because `backend/venv` targets a missing Python 3.13 installation. Frontend tests and build remain executable with `npm.cmd`.

---

## File Structure

- `backend/Inquiry/models.py` — owns the new payment ledger model.
- `backend/Inquiry/migrations/0007_paymentdetail_tbl.py` — creates the payment ledger database table.
- `backend/Inquiry/payment_ledger.py` — owns balance calculations and transactional payment recording.
- `backend/Inquiry/serializers.py` — validates payment requests and serializes pending-list rows.
- `backend/Inquiry/views.py` — exposes pending-list and payment-recording actions.
- `backend/Inquiry/tests.py` — API/service regression coverage for the ledger workflow.
- `backend/masters/migrations/0011_payment_pending_menu.py` — adds the separate Payment Pending menu.
- `frontend/src/pages/PaymentPending.jsx` — renders outstanding payments and the Paid modal.
- `frontend/src/pages/PaymentPending.css` — owns the page and modal styles.
- `frontend/src/pages/paymentPendingState.js` — pure list-update helpers after payments are recorded.
- `frontend/src/pages/paymentPendingState.test.js` — tests pending-list updates.
- `frontend/src/pages/Dashboard.jsx` — registers the new menu page and role visibility.

### Task 1: Add the append-only payment ledger model

**Files:**
- Modify: `backend/Inquiry/models.py`
- Create: `backend/Inquiry/migrations/0007_paymentdetail_tbl.py`
- Test: `backend/Inquiry/tests.py`

**Interfaces:**
- Produces: `PaymentDetail` with `Inquiry_Product`, `Amount`, `Payment_Type`, `Payment_Date`, `Created_By`, and `Created_On` fields.
- Consumed by: `backend/Inquiry/payment_ledger.py` and payment-pending serializers.

- [ ] **Step 1: Write the failing model-relationship test**

```python
def test_payment_detail_keeps_an_individual_installment(self):
    detail = PaymentDetail.objects.create(
        Inquiry_Product=self.pending_payment,
        Amount=Decimal("25.00"),
        Payment_Type=PaymentDetail.PaymentType.INSTALLMENT,
        Created_By=self.admin_user,
    )

    self.assertEqual(detail.Inquiry_Product_id, self.pending_payment.id)
    self.assertEqual(detail.Amount, Decimal("25.00"))
    self.assertEqual(detail.Payment_Type, "installment")
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `backend/venv/Scripts/python.exe backend/manage.py test Inquiry.tests.PaymentApprovalAccessTests.test_payment_detail_keeps_an_individual_installment -v 2`

Expected: fail because `PaymentDetail` does not exist. If the command instead reports the known missing Python 3.13 executable, record that environmental blocker and continue with the test-first source change.

- [ ] **Step 3: Add the model and migration**

```python
class PaymentDetail(models.Model):
    class PaymentType(models.TextChoices):
        FULL = "full", "Full Payment"
        INSTALLMENT = "installment", "Installment"

    Inquiry_Product = models.ForeignKey(
        InquiryProductDetails_tbl,
        on_delete=models.CASCADE,
        related_name="payment_details",
        db_column="Inquiry_Product_Id",
    )
    Amount = models.DecimalField(max_digits=12, decimal_places=2)
    Payment_Type = models.CharField(max_length=20, choices=PaymentType.choices)
    Payment_Date = models.DateTimeField(auto_now_add=True)
    Created_By = models.ForeignKey(User, on_delete=models.PROTECT)
    Created_On = models.DateTimeField(auto_now_add=True)
```

Create the matching migration table named `PaymentDetail_tbl` using the app’s existing `db_column` naming convention.

- [ ] **Step 4: Run the focused model test**

Run: `backend/venv/Scripts/python.exe backend/manage.py test Inquiry.tests.PaymentApprovalAccessTests.test_payment_detail_keeps_an_individual_installment -v 2`

Expected: PASS once the Python environment is repaired; otherwise preserve the exact runtime blocker in the handoff.

### Task 2: Implement transactional balance calculation and payment recording

**Files:**
- Create: `backend/Inquiry/payment_ledger.py`
- Modify: `backend/Inquiry/tests.py`

**Interfaces:**
- Consumes: `PaymentDetail`, `InquiryProductDetails_tbl`, a Django user, `Decimal` amount, and payment type string.
- Produces: `record_payment(*, product_id, user, amount, payment_type) -> (product, total_paid, remaining_balance)`.

- [ ] **Step 1: Write failing service tests for valid and invalid payments**

```python
def test_installment_reduces_remaining_balance_and_keeps_pending(self):
    product, total_paid, remaining = record_payment(
        product_id=self.pending_payment.id,
        user=self.admin_user,
        amount=Decimal("4.00"),
        payment_type="installment",
    )
    self.assertEqual(total_paid, Decimal("4.00"))
    self.assertEqual(remaining, Decimal("6.00"))
    self.assertEqual(product.Payment_Status, "Pending")

def test_full_payment_requires_the_exact_remaining_balance(self):
    with self.assertRaises(ValidationError):
        record_payment(
            product_id=self.pending_payment.id,
            user=self.admin_user,
            amount=Decimal("9.00"),
            payment_type="full",
        )

def test_overpayment_is_rejected_without_creating_a_detail(self):
    with self.assertRaises(ValidationError):
        record_payment(
            product_id=self.pending_payment.id,
            user=self.admin_user,
            amount=Decimal("11.00"),
            payment_type="installment",
        )
    self.assertFalse(self.pending_payment.payment_details.exists())
```

- [ ] **Step 2: Run the service tests to verify they fail**

Run: `backend/venv/Scripts/python.exe backend/manage.py test Inquiry.tests.PaymentApprovalAccessTests -v 2`

Expected: fail because `record_payment` is not implemented, subject to the existing Python-runtime blocker.

- [ ] **Step 3: Implement the service with a locked product row**

```python
@transaction.atomic
def record_payment(*, product_id, user, amount, payment_type):
    product = InquiryProductDetails_tbl.objects.select_for_update().get(
        pk=product_id,
        Revenue_Amount__gt=0,
        Payment_Status="Pending",
    )
    total_paid = product.payment_details.aggregate(
        total=Coalesce(Sum("Amount"), Decimal("0.00"))
    )["total"]
    remaining = product.Revenue_Amount - total_paid
    # validate amount and payment_type before creating PaymentDetail
    detail = PaymentDetail.objects.create(...)
    updated_total = total_paid + amount
    updated_remaining = product.Revenue_Amount - updated_total
    if updated_remaining == 0:
        product.Payment_Status = "Received"
        product.save(update_fields=["Payment_Status"])
    return product, updated_total, updated_remaining
```

Raise DRF/Django validation errors for unknown payment types, non-positive amounts, full-payment mismatches, and amounts above the remaining balance. Use `get_object_or_404` or an equivalent `DoesNotExist` translation for closed/non-revenue products so the endpoint returns 404.

- [ ] **Step 4: Run the focused service tests**

Run: `backend/venv/Scripts/python.exe backend/manage.py test Inquiry.tests.PaymentApprovalAccessTests -v 2`

Expected: PASS once Django can start.

### Task 3: Add payment-pending API endpoints and role tests

**Files:**
- Modify: `backend/Inquiry/serializers.py`
- Modify: `backend/Inquiry/views.py`
- Modify: `backend/Inquiry/tests.py`

**Interfaces:**
- Produces: `GET /api/inquiries/payment-pending/` returning outstanding products with `total_paid` and `remaining_balance`.
- Produces: `POST /api/inquiries/payment-pending/<product_id>/paid/` accepting `{ "amount": "4.00", "payment_type": "installment" }`.
- Consumes: `record_payment` from `backend/Inquiry/payment_ledger.py`.

- [ ] **Step 1: Write failing endpoint and authorization tests**

```python
def test_admin_can_list_only_outstanding_payment_records(self):
    response = self.client.get("/api/inquiries/payment-pending/")
    self.assertEqual(response.status_code, 200)
    self.assertEqual(response.data[0]["remaining_balance"], "10.00")

def test_admin_can_record_an_installment_from_the_pending_page(self):
    response = self.client.post(
        f"/api/inquiries/payment-pending/{self.pending_payment.id}/paid/",
        {"amount": "4.00", "payment_type": "installment"},
        format="json",
    )
    self.assertEqual(response.status_code, 200)
    self.assertEqual(response.data["remaining_balance"], "6.00")

def test_regular_staff_cannot_record_a_payment(self):
    self.client.force_authenticate(self.staff_user)
    response = self.client.post(..., format="json")
    self.assertEqual(response.status_code, 403)
```

- [ ] **Step 2: Run the endpoint tests to verify they fail**

Run: `backend/venv/Scripts/python.exe backend/manage.py test Inquiry.tests.PaymentApprovalAccessTests -v 2`

Expected: fail because the pending endpoints and serializers do not exist, subject to the known Python blocker.

- [ ] **Step 3: Add serializer and view actions**

```python
class PaymentRecordSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal("0.01"))
    payment_type = serializers.ChoiceField(choices=("full", "installment"))

@action(detail=False, methods=["get"], url_path="payment-pending")
def payment_pending(self, request):
    self._require_payment_approval_viewer(request)
    # annotate paid total, calculate remaining balance, filter remaining > 0

@action(detail=False, methods=["post"], url_path=r"payment-pending/(?P<product_id>[^/.]+)/paid")
def payment_paid(self, request, product_id=None):
    self._require_payment_approval_viewer(request)
    serializer = PaymentRecordSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    product, total_paid, remaining = record_payment(...)
    return Response({"id": product.id, "total_paid": total_paid, "remaining_balance": remaining, "payment_status": product.Payment_Status})
```

Use `PaymentApprovalSerializer` as the base for customer/product fields and add explicit `total_paid` and `remaining_balance` values to the pending-list response.

- [ ] **Step 4: Run all Inquiry tests**

Run: `backend/venv/Scripts/python.exe backend/manage.py test Inquiry -v 1`

Expected: PASS after the Python runtime is restored.

### Task 4: Add the separate Payment Pending menu and page

**Files:**
- Create: `backend/masters/migrations/0011_payment_pending_menu.py`
- Create: `frontend/src/pages/PaymentPending.jsx`
- Create: `frontend/src/pages/PaymentPending.css`
- Create: `frontend/src/pages/paymentPendingState.js`
- Create: `frontend/src/pages/paymentPendingState.test.js`
- Modify: `frontend/src/pages/Dashboard.jsx`

**Interfaces:**
- Consumes: `GET /api/inquiries/payment-pending/` and `POST /api/inquiries/payment-pending/<id>/paid/`.
- Consumes: `applyRecordedPayment(payments, paymentResult) -> payments`.
- Produces: a `Payment Pending` dashboard page visible to Admin and Super Admin.

- [ ] **Step 1: Write the failing pure state tests**

```javascript
test("an installment keeps the row and updates its paid and remaining amounts", () => {
  const rows = [{ id: 1, total_paid: "0.00", remaining_balance: "10.00" }];
  assert.deepEqual(applyRecordedPayment(rows, {
    id: 1, total_paid: "4.00", remaining_balance: "6.00", payment_status: "Pending",
  }), [{ id: 1, total_paid: "4.00", remaining_balance: "6.00" }]);
});

test("a full payment removes the completed row from the pending list", () => {
  const rows = [{ id: 1, total_paid: "4.00", remaining_balance: "6.00" }];
  assert.deepEqual(applyRecordedPayment(rows, {
    id: 1, total_paid: "10.00", remaining_balance: "0.00", payment_status: "Received",
  }), []);
});
```

- [ ] **Step 2: Run the state tests to verify they fail**

Run: `npm.cmd test -- paymentPendingState.test.js`

Expected: FAIL with module/function not found.

- [ ] **Step 3: Implement the pending-list state helper**

```javascript
export function applyRecordedPayment(payments, result) {
  if (result.remaining_balance === "0.00") {
    return payments.filter((payment) => payment.id !== result.id);
  }
  return payments.map((payment) =>
    payment.id === result.id
      ? { ...payment, total_paid: result.total_paid, remaining_balance: result.remaining_balance }
      : payment,
  );
}
```

- [ ] **Step 4: Run the state tests to verify they pass**

Run: `npm.cmd test -- paymentPendingState.test.js`

Expected: PASS.

- [ ] **Step 5: Create the menu migration and React page**

Create a `Payment Pending` `MenuMaster` row following `0009_payment_approval_menu.py`. Build the page with the existing approval-table visual language, table columns for total due/paid/remaining, and a Paid button.

The modal must:

```jsx
<input type="number" min="0.01" step="0.01" value={amount} onChange={...} />
<label><input type="radio" value="full" checked={paymentType === "full"} onChange={...} /> Full Payment</label>
<label><input type="radio" value="installment" checked={paymentType === "installment"} onChange={...} /> Installment</label>
```

When `full` is selected, set the amount to the displayed remaining balance. Submit the exact JSON API contract above, display API validation errors in the modal, and use `applyRecordedPayment` for the successful response.

Update Dashboard imports, the menu visibility filter, and the active-page render chain so both Admin and Super Admin can access Payment Pending.

- [ ] **Step 6: Run frontend verification**

Run: `npm.cmd test -- paymentPendingState.test.js`

Expected: all Node tests pass.

Run: `npm.cmd run build`

Expected: Vite production build exits with status 0.

## Self-Review

- Spec coverage: Task 1 implements the ledger; Task 2 implements locking, validation, and status transitions; Task 3 implements permissions and API contracts; Task 4 implements the separate menu/page/modal and frontend behavior.
- Placeholder scan: no incomplete requirements or deferred implementation steps remain.
- Type consistency: the backend API uses `amount` and `payment_type`; its response uses `id`, `total_paid`, `remaining_balance`, and `payment_status`; the state helper consumes the same response keys.
