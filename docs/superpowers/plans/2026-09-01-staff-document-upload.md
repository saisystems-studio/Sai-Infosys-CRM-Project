# Staff Document Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure multi-document upload, listing, download, and deletion to Add/Edit Staff using a separate staff-document table.

**Architecture:** `StaffDocument` owns one uploaded file and belongs to `StaffDetails` through a cascading foreign key. The existing multipart staff create/update endpoints accept repeated `Staff_Documents` fields, while nested permission-checked viewset actions handle download and deletion. A focused frontend helper validates selections and constructs document form fields; Add Staff renders pending and stored files.

**Tech Stack:** Django 6.1, Django REST Framework, SQL Server, React 19, Axios, Vite, Node test runner

**Spec:** `docs/superpowers/specs/2026-09-01-staff-document-upload-design.md`

## Global Constraints

- Maximum file size is 10 MB per document.
- Accepted extensions are PDF, DOC/DOCX, XLS/XLSX, TXT, CSV, JPG/JPEG, PNG, and WEBP.
- Executable, script, archive, and unrecognized files are rejected.
- Stored filenames are generated; user filenames are display metadata only.
- Stored paths remain relative to `MEDIA_ROOT` and cleanup cannot escape `MEDIA_ROOT`.
- Upload/delete uses existing Add Staff/Edit Staff permissions; metadata/download uses Staff List view permission.
- Existing staff photo and menu-permission behavior must remain unchanged.
- Do not add folders, versions, sharing, content search, external storage, or per-file progress.

## File Structure

- Create `backend/staff/document_files.py`: upload naming, allowlist validation, and safe file deletion.
- Modify `backend/staff/models.py`: define `StaffDocument` and deletion cleanup hooks.
- Create `backend/staff/migrations/0002_staffdocument.py`: create `StaffDocument_tbl`.
- Modify `backend/staff/serializers.py`: serialize metadata and save repeated uploads during staff create/update.
- Modify `backend/staff/views.py`: prefetch documents and expose nested download/delete actions.
- Create `backend/staff/test_documents.py`: model, validation, serializer, endpoint, permission, and cleanup tests.
- Create `frontend/src/pages/Staff/staffDocuments.js`: selection validation, formatting, and multipart helpers.
- Create `frontend/src/pages/Staff/staffDocuments.test.js`: frontend document behavior tests.
- Modify `frontend/src/pages/Staff/AddStaff.jsx`: document state, handlers, multipart submission, existing-document actions, and UI.
- Modify `frontend/src/pages/Staff/AddStaff.css`: compact responsive document panel.

---

### Task 1: Staff document model, validation, and safe storage

**Files:**
- Create: `backend/staff/document_files.py`
- Modify: `backend/staff/models.py`
- Create: `backend/staff/migrations/0002_staffdocument.py`
- Create: `backend/staff/test_documents.py`

**Interfaces:**
- Produces: `validate_staff_document(upload) -> upload`
- Produces: `staff_document_upload_to(instance, filename) -> str`
- Produces: `delete_media_file_safely(field_file) -> None`
- Produces: `StaffDocument` with related name `Documents`

- [ ] **Step 1: Write failing model and validation tests**

```python
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.exceptions import ValidationError
from django.test import TestCase, override_settings

from staff.document_files import validate_staff_document
from staff.models import StaffDocument


def upload(name="contract.pdf", size=32, content_type="application/pdf"):
    return SimpleUploadedFile(name, b"x" * size, content_type=content_type)


class StaffDocumentModelTests(TestCase):
    def test_document_belongs_to_staff_and_records_metadata(self):
        document = StaffDocument.objects.create(
            Staff_Id=self.staff,
            Document_File=upload(),
            Original_Name="contract.pdf",
            Mime_Type="application/pdf",
            File_Size=32,
            Uploaded_By=self.user,
        )
        self.assertEqual(document.Staff_Id_id, self.staff.pk)
        self.assertTrue(document.Document_File.name.startswith(
            f"staff/documents/{self.staff.pk}/"
        ))

    def test_rejects_file_larger_than_ten_megabytes(self):
        with self.assertRaisesMessage(ValidationError, "10 MB"):
            validate_staff_document(upload(size=10 * 1024 * 1024 + 1))

    def test_rejects_executable_extension(self):
        with self.assertRaisesMessage(ValidationError, "not supported"):
            validate_staff_document(upload("payload.exe", content_type="application/octet-stream"))
```

Use `tempfile.TemporaryDirectory()` plus `override_settings(MEDIA_ROOT=...)` in setup/cleanup so tests never write to project uploads.

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `backend\venv\Scripts\python.exe backend\manage.py test staff.test_documents.StaffDocumentModelTests --verbosity 2`

Expected: import/model failures because `StaffDocument` and `document_files.py` do not exist.

- [ ] **Step 3: Implement validation and safe storage helpers**

```python
# backend/staff/document_files.py
from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.exceptions import ValidationError

MAX_STAFF_DOCUMENT_BYTES = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".txt", ".csv", ".jpg", ".jpeg", ".png", ".webp",
}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain", "text/csv", "image/jpeg", "image/png", "image/webp",
}


def validate_staff_document(upload):
    extension = Path(upload.name).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise ValidationError(f"{upload.name}: file type is not supported.")
    if upload.size > MAX_STAFF_DOCUMENT_BYTES:
        raise ValidationError(f"{upload.name}: maximum size is 10 MB.")
    if upload.content_type not in ALLOWED_MIME_TYPES:
        raise ValidationError(f"{upload.name}: file content type is not supported.")
    return upload


def staff_document_upload_to(instance, filename):
    extension = Path(filename).suffix.lower()
    return f"staff/documents/{instance.Staff_Id_id}/{uuid4().hex}{extension}"


def delete_media_file_safely(field_file):
    if not field_file or not field_file.name:
        return
    media_root = Path(settings.MEDIA_ROOT).resolve()
    try:
        resolved = Path(field_file.path).resolve()
    except (NotImplementedError, ValueError):
        field_file.storage.delete(field_file.name)
        return
    if resolved == media_root or media_root not in resolved.parents:
        raise ValueError("Refusing to delete a file outside MEDIA_ROOT.")
    field_file.storage.delete(field_file.name)
```

- [ ] **Step 4: Add `StaffDocument` and migration**

```python
class StaffDocument(models.Model):
    Id = models.AutoField(primary_key=True, db_column="Id")
    Staff_Id = models.ForeignKey(
        StaffDetails,
        on_delete=models.CASCADE,
        related_name="Documents",
        db_column="Staff_Id",
    )
    Document_File = models.FileField(
        upload_to=staff_document_upload_to,
        validators=[validate_staff_document],
        db_column="Document_File",
    )
    Original_Name = models.CharField(max_length=255, db_column="Original_Name")
    Mime_Type = models.CharField(max_length=150, db_column="Mime_Type")
    File_Size = models.PositiveBigIntegerField(db_column="File_Size")
    Uploaded_By = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="staff_documents_uploaded",
        db_column="Uploaded_By",
    )
    Uploaded_On = models.DateTimeField(auto_now_add=True, db_column="Uploaded_On")

    class Meta:
        db_table = "StaffDocument_tbl"
        ordering = ["-Uploaded_On", "-Id"]
```

Generate the migration with:

`backend\venv\Scripts\python.exe backend\manage.py makemigrations staff`

Assert the generated file is named `0002_staffdocument.py` and contains only the new table.

- [ ] **Step 5: Add post-delete cleanup and test cascade cleanup**

```python
@receiver(post_delete, sender=StaffDocument)
def remove_staff_document_file(sender, instance, **kwargs):
    delete_media_file_safely(instance.Document_File)
```

Add tests that delete one document and one parent staff record, then assert `Path(saved_path).exists()` is false and the related rows are gone.

- [ ] **Step 6: Run tests and migration check**

Run:

```powershell
backend\venv\Scripts\python.exe backend\manage.py test staff.test_documents.StaffDocumentModelTests --verbosity 2
backend\venv\Scripts\python.exe backend\manage.py makemigrations --check --dry-run
```

Expected: model tests pass; migration check prints `No changes detected`.

- [ ] **Step 7: Commit**

```powershell
git add backend/staff/document_files.py backend/staff/models.py backend/staff/migrations/0002_staffdocument.py backend/staff/test_documents.py
git commit -m "feat: add staff document storage model"
```

### Task 2: Multipart staff create/update and document serialization

**Files:**
- Modify: `backend/staff/serializers.py`
- Modify: `backend/staff/test_documents.py`

**Interfaces:**
- Consumes: `StaffDocument`, `validate_staff_document(upload)`
- Produces: response field `Documents: StaffDocumentSerializer[]`
- Consumes request multipart key: repeated `Staff_Documents`

- [ ] **Step 1: Write failing serializer/API upload tests**

```python
def test_create_staff_saves_multiple_documents(self):
    payload = self.valid_staff_payload()
    payload["Staff_Documents"] = [upload("contract.pdf"), upload("id.png", content_type="image/png")]
    response = self.client.post("/api/staff/", payload, format="multipart")
    self.assertEqual(response.status_code, 201)
    staff = StaffDetails.objects.get(pk=response.data["Id"])
    self.assertEqual(staff.Documents.count(), 2)
    self.assertEqual(
        {row["Original_Name"] for row in response.data["Documents"]},
        {"contract.pdf", "id.png"},
    )

def test_update_appends_document_without_removing_existing_document(self):
    response = self.client.put(
        f"/api/staff/{self.staff.pk}/",
        {**self.valid_update_payload(), "Staff_Documents": [upload("new.pdf")]},
        format="multipart",
    )
    self.assertEqual(response.status_code, 200)
    self.assertEqual(self.staff.Documents.count(), 2)
```

Also test that an invalid file rejects the entire request before staff/document rows are created.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `backend\venv\Scripts\python.exe backend\manage.py test staff.test_documents.StaffDocumentSerializerTests --verbosity 2`

Expected: response lacks `Documents` and no document rows are created.

- [ ] **Step 3: Add metadata serializer and multipart list field**

```python
class StaffDocumentSerializer(serializers.ModelSerializer):
    Download_Url = serializers.SerializerMethodField()

    class Meta:
        model = StaffDocument
        fields = [
            "Id", "Original_Name", "Mime_Type", "File_Size",
            "Uploaded_On", "Download_Url",
        ]

    def get_Download_Url(self, obj):
        request = self.context.get("request")
        path = reverse("staff-document-download", kwargs={
            "pk": obj.Staff_Id_id,
            "document_id": obj.pk,
        })
        return request.build_absolute_uri(path) if request else path
```

In `StaffDetailsSerializer`, add read-only `Documents = StaffDocumentSerializer(many=True, read_only=True)` and include it in `fields`.

Read uploads directly from `request.FILES.getlist("Staff_Documents")`; do not model them as a scalar serializer field.

- [ ] **Step 4: Validate all uploads before database mutation**

```python
def _get_validated_documents(self):
    request = self.context.get("request")
    uploads = request.FILES.getlist("Staff_Documents") if request else []
    for upload in uploads:
        validate_staff_document(upload)
    return uploads
```

Call this at the start of both `create()` and `update()`.

- [ ] **Step 5: Save document metadata and clean files after failure**

```python
def _save_documents(self, staff, uploads, user):
    created = []
    try:
        for upload in uploads:
            created.append(StaffDocument.objects.create(
                Staff_Id=staff,
                Document_File=upload,
                Original_Name=Path(upload.name).name[:255],
                Mime_Type=upload.content_type or "application/octet-stream",
                File_Size=upload.size,
                Uploaded_By=user if user and user.is_authenticated else None,
            ))
        return created
    except Exception:
        for document in created:
            delete_media_file_safely(document.Document_File)
        raise
```

Keep database writes inside `transaction.atomic`. Add a test that patches the second `StaffDocument.objects.create` to raise and asserts no staff document file remains in temporary `MEDIA_ROOT`.

- [ ] **Step 6: Run focused and existing staff tests**

Run:

```powershell
backend\venv\Scripts\python.exe backend\manage.py test staff.test_documents.StaffDocumentSerializerTests staff.tests --verbosity 2
```

Expected: all pass.

- [ ] **Step 7: Commit**

```powershell
git add backend/staff/serializers.py backend/staff/test_documents.py
git commit -m "feat: upload documents with staff records"
```

### Task 3: Permission-checked document download and deletion

**Files:**
- Modify: `backend/staff/views.py`
- Modify: `backend/staff/test_documents.py`

**Interfaces:**
- Produces: `GET /api/staff/{staff_id}/documents/{document_id}/download/`
- Produces: `DELETE /api/staff/{staff_id}/documents/{document_id}/`
- Consumes: existing `HasMenuPermission` and `menu_permission(...)`

- [ ] **Step 1: Write failing nested-action tests**

```python
def test_view_authorized_user_downloads_document(self):
    response = self.client.get(
        f"/api/staff/{self.staff.pk}/documents/{self.document.pk}/download/"
    )
    self.assertEqual(response.status_code, 200)
    self.assertEqual(response["Content-Disposition"], 'attachment; filename="contract.pdf"')

def test_edit_authorized_user_deletes_document_and_file(self):
    saved_path = Path(self.document.Document_File.path)
    response = self.client.delete(
        f"/api/staff/{self.staff.pk}/documents/{self.document.pk}/"
    )
    self.assertEqual(response.status_code, 204)
    self.assertFalse(saved_path.exists())

def test_nested_route_cannot_access_document_from_another_staff(self):
    response = self.client.get(
        f"/api/staff/{self.other_staff.pk}/documents/{self.document.pk}/download/"
    )
    self.assertEqual(response.status_code, 404)
```

Add separate permission fixtures proving view-only users cannot delete and users without Staff List view cannot download.

- [ ] **Step 2: Run focused endpoint tests and confirm RED**

Run: `backend\venv\Scripts\python.exe backend\manage.py test staff.test_documents.StaffDocumentEndpointTests --verbosity 2`

Expected: 404 because nested actions do not exist.

- [ ] **Step 3: Prefetch documents and implement nested lookup**

Add `Documents` to the staff queryset prefetch list.

```python
def _get_document(self, staff_id, document_id):
    return get_object_or_404(
        StaffDocument,
        Staff_Id_id=staff_id,
        pk=document_id,
    )
```

- [ ] **Step 4: Implement download and delete actions**

```python
@action(
    detail=True,
    methods=["get"],
    url_path=r"documents/(?P<document_id>[^/.]+)/download",
    url_name="document-download",
    permission_classes=[IsAuthenticated, menu_permission("Staff List")],
)
def document_download(self, request, pk=None, document_id=None):
    document = self._get_document(pk, document_id)
    response = FileResponse(
        document.Document_File.open("rb"),
        as_attachment=True,
        filename=document.Original_Name,
        content_type=document.Mime_Type,
    )
    return response

@action(
    detail=True,
    methods=["delete"],
    url_path=r"documents/(?P<document_id>[^/.]+)",
    url_name="document-delete",
    permission_classes=[IsAuthenticated, menu_permission("Staff List", "Add Staff")],
)
def document_delete(self, request, pk=None, document_id=None):
    document = self._get_document(pk, document_id)
    document.delete()
    return Response(status=204)
```

Ensure the delete permission resolves `Can_Edit`, not `Can_Delete`, by adding a dedicated permission class or explicit `StaffMenuPermission` check matching the approved spec. Do not rely on the HTTP DELETE default mapping to `Can_Delete`.

- [ ] **Step 5: Run endpoint and full staff tests**

Run:

```powershell
backend\venv\Scripts\python.exe backend\manage.py test staff.test_documents.StaffDocumentEndpointTests staff --verbosity 1
```

Expected: all pass.

- [ ] **Step 6: Commit**

```powershell
git add backend/staff/views.py backend/staff/test_documents.py
git commit -m "feat: manage staff documents securely"
```

### Task 4: Frontend document selection and multipart helpers

**Files:**
- Create: `frontend/src/pages/Staff/staffDocuments.js`
- Create: `frontend/src/pages/Staff/staffDocuments.test.js`

**Interfaces:**
- Produces: `validateStaffDocuments(files) -> { accepted: File[], errors: string[] }`
- Produces: `appendStaffDocuments(formData, files) -> FormData`
- Produces: `formatDocumentSize(bytes) -> string`

- [ ] **Step 1: Write failing helper tests**

```javascript
test("accepts multiple supported staff documents", () => {
  const files = [
    { name: "contract.pdf", size: 100, type: "application/pdf" },
    { name: "photo.png", size: 200, type: "image/png" },
  ];
  assert.deepEqual(validateStaffDocuments(files), { accepted: files, errors: [] });
});

test("rejects unsupported and oversized documents", () => {
  const result = validateStaffDocuments([
    { name: "script.exe", size: 100, type: "application/octet-stream" },
    { name: "large.pdf", size: 10 * 1024 * 1024 + 1, type: "application/pdf" },
  ]);
  assert.equal(result.accepted.length, 0);
  assert.equal(result.errors.length, 2);
});

test("appends every document under the repeated multipart key", () => {
  const entries = [];
  const formData = { append: (key, value) => entries.push([key, value]) };
  appendStaffDocuments(formData, ["first", "second"]);
  assert.deepEqual(entries, [
    ["Staff_Documents", "first"],
    ["Staff_Documents", "second"],
  ]);
});
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `cd frontend; npm.cmd test -- --test-name-pattern="staff document"`

Expected: module-not-found failure for `staffDocuments.js`.

- [ ] **Step 3: Implement minimal helpers**

```javascript
export const MAX_STAFF_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const STAFF_DOCUMENT_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "txt", "csv",
  "jpg", "jpeg", "png", "webp",
]);

export function validateStaffDocuments(files = []) {
  const accepted = [];
  const errors = [];
  for (const file of files) {
    const extension = String(file.name || "").split(".").pop().toLowerCase();
    if (!STAFF_DOCUMENT_EXTENSIONS.has(extension)) {
      errors.push(`${file.name}: file type is not supported.`);
    } else if (file.size > MAX_STAFF_DOCUMENT_BYTES) {
      errors.push(`${file.name}: maximum size is 10 MB.`);
    } else {
      accepted.push(file);
    }
  }
  return { accepted, errors };
}

export function appendStaffDocuments(formData, files = []) {
  files.forEach((file) => formData.append("Staff_Documents", file));
  return formData;
}

export function formatDocumentSize(bytes = 0) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

- [ ] **Step 4: Run helper tests**

Run: `cd frontend; npm.cmd test -- --test-name-pattern="staff document"`

Expected: all helper tests pass.

- [ ] **Step 5: Commit**

```powershell
git add frontend/src/pages/Staff/staffDocuments.js frontend/src/pages/Staff/staffDocuments.test.js
git commit -m "test: define staff document upload behavior"
```

### Task 5: Add/Edit Staff document panel

**Files:**
- Modify: `frontend/src/pages/Staff/AddStaff.jsx`
- Modify: `frontend/src/pages/Staff/AddStaff.css`
- Modify: `frontend/src/pages/Staff/staffDocuments.test.js`

**Interfaces:**
- Consumes: `validateStaffDocuments`, `appendStaffDocuments`, `formatDocumentSize`
- Consumes staff response: `Documents[]`
- Consumes endpoints from Task 3

- [ ] **Step 1: Extend helper tests for immutable pending-file removal**

Add and test:

```javascript
export function removePendingDocument(files, indexToRemove) {
  return files.filter((_, index) => index !== indexToRemove);
}

test("removes one pending document without changing the other selections", () => {
  assert.deepEqual(removePendingDocument(["a", "b", "c"], 1), ["a", "c"]);
});
```

- [ ] **Step 2: Run the new test and confirm RED, then implement helper**

Run: `cd frontend; npm.cmd test -- --test-name-pattern="pending document"`

Expected before implementation: missing export/failure. Add the function shown above, rerun, and expect PASS.

- [ ] **Step 3: Add component state and load existing documents**

```javascript
const [documents, setDocuments] = useState([]);
const [existingDocuments, setExistingDocuments] = useState([]);
const [documentErrors, setDocumentErrors] = useState([]);
const [deletingDocumentId, setDeletingDocumentId] = useState(null);
```

When edit data loads, set `existingDocuments` from `staffData.Documents || []`. On successful create reset pending documents; on failed save leave them unchanged.

- [ ] **Step 4: Add selection, drop, pending removal, and stored deletion handlers**

```javascript
const addDocuments = (fileList) => {
  const { accepted, errors } = validateStaffDocuments(Array.from(fileList || []));
  setDocuments((current) => [...current, ...accepted]);
  setDocumentErrors(errors);
};

const deleteExistingDocument = async (document) => {
  if (!window.confirm(`Delete ${document.Original_Name}?`)) return;
  setDeletingDocumentId(document.Id);
  try {
    await axios.delete(
      `${API_URL}/staff/${editData.Id}/documents/${document.Id}/`,
      { headers: { Authorization: `Bearer ${localStorage.getItem("crm_access_token")}` } },
    );
    setExistingDocuments((current) => current.filter((item) => item.Id !== document.Id));
  } catch (requestError) {
    setError(requestError.response?.data?.detail || "Unable to delete document.");
  } finally {
    setDeletingDocumentId(null);
  }
};
```

Prevent default browser behavior in `onDragOver`, and call `addDocuments(event.dataTransfer.files)` in `onDrop`.

- [ ] **Step 5: Append pending documents to the existing multipart request**

Immediately after the existing `Staff_Image` append:

```javascript
appendStaffDocuments(data, documents);
```

Do not manually set a multipart boundary; keep the existing Axios request style unless integration testing shows the explicit content-type header prevents boundary generation.

- [ ] **Step 6: Render the document panel beside the photo**

Use this semantic structure inside `.staff-image-section`:

```jsx
<section
  className="staff-document-panel"
  onDragOver={(event) => event.preventDefault()}
  onDrop={(event) => {
    event.preventDefault();
    addDocuments(event.dataTransfer.files);
  }}
>
  <div className="staff-document-heading">
    <div><strong>Attach documents</strong><small>Up to 10 MB per file</small></div>
    <label className="document-upload-button">
      Add files
      <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.webp" onChange={(event) => addDocuments(event.target.files)} />
    </label>
  </div>
  <p className="staff-document-drop">Drop files here or choose files</p>
  {documentErrors.map((message) => <div className="staff-document-error" key={message}>{message}</div>)}
  <div className="staff-document-list">
    {existingDocuments.map((document) => (
      <div className="staff-document-item" key={`stored-${document.Id}`}>
        <div><strong>{document.Original_Name}</strong><small>{formatDocumentSize(document.File_Size)}</small></div>
        <a href={document.Download_Url}>View</a>
        <button type="button" disabled={deletingDocumentId === document.Id} onClick={() => deleteExistingDocument(document)}>Delete</button>
      </div>
    ))}
    {documents.map((file, index) => (
      <div className="staff-document-item is-pending" key={`${file.name}-${file.size}-${index}`}>
        <div><strong>{file.name}</strong><small>{formatDocumentSize(file.size)} · Ready to upload</small></div>
        <button type="button" onClick={() => setDocuments((current) => removePendingDocument(current, index))}>Remove</button>
      </div>
    ))}
  </div>
</section>
```

Use an authenticated fetch/blob handler for View/Download if bearer authentication is required; do not rely on a plain anchor if the endpoint rejects unauthenticated navigation.

- [ ] **Step 7: Add compact responsive styling**

```css
.staff-image-section {
  display: grid;
  grid-template-columns: minmax(280px, .8fr) minmax(360px, 1.2fr);
  gap: 24px;
  align-items: start;
}

.staff-document-panel {
  min-width: 0;
  padding: 14px;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  background: #f8fafc;
}

.staff-document-heading,
.staff-document-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.staff-document-list {
  display: grid;
  gap: 7px;
  max-height: 180px;
  overflow-y: auto;
}

@media (max-width: 800px) {
  .staff-image-section { grid-template-columns: 1fr; }
}
```

Extend styles for hidden input, buttons, error text, truncation, focus states, and pending/stored status without changing unrelated staff form rules.

- [ ] **Step 8: Run frontend tests, lint, and build**

Run:

```powershell
cd frontend
npm.cmd test
npx.cmd eslint src/pages/Staff/AddStaff.jsx src/pages/Staff/staffDocuments.js src/pages/Staff/staffDocuments.test.js
npm.cmd run build
```

Expected: all commands exit 0.

- [ ] **Step 9: Commit**

```powershell
git add frontend/src/pages/Staff/AddStaff.jsx frontend/src/pages/Staff/AddStaff.css frontend/src/pages/Staff/staffDocuments.js frontend/src/pages/Staff/staffDocuments.test.js
git commit -m "feat: add staff document upload panel"
```

### Task 6: End-to-end verification and documentation alignment

**Files:**
- Modify only if verification finds a defect in files listed in Tasks 1-5.

**Interfaces:**
- Verifies all interfaces produced by Tasks 1-5.

- [ ] **Step 1: Apply migrations in the development environment**

Run: `backend\venv\Scripts\python.exe backend\manage.py migrate`

Expected: `staff.0002_staffdocument` applies successfully.

- [ ] **Step 2: Run backend verification**

```powershell
backend\venv\Scripts\python.exe backend\manage.py makemigrations --check --dry-run
backend\venv\Scripts\python.exe backend\manage.py test staff --verbosity 1
```

Expected: no model changes and all staff tests pass. If the SQL Server test database already exists, stop and resolve that environment state explicitly rather than deleting it without authorization.

- [ ] **Step 3: Run frontend verification**

```powershell
cd frontend
npm.cmd test
npm.cmd run build
npx.cmd eslint src/pages/Staff/AddStaff.jsx src/pages/Staff/staffDocuments.js src/pages/Staff/staffDocuments.test.js
```

Expected: all tests pass, Vite build exits 0, and changed files have no lint errors.

- [ ] **Step 4: Perform manual acceptance checks**

Verify in Add Staff:

1. Select a photo and several valid documents.
2. Remove one pending document.
3. Save and confirm the staff response lists the remaining documents.
4. Confirm files exist only under `backend/uploads/staff/documents/<staff-id>/`.
5. Open Edit Staff and confirm existing documents render.
6. Download one document through the authenticated action.
7. Delete one document and confirm both its row and physical file are removed.
8. Try an `.exe` and a file over 10 MB and confirm clear rejection.
9. Delete a disposable staff record and confirm all related document files are removed.

- [ ] **Step 5: Review the final diff for scope and secrets**

Run:

```powershell
git diff --check
git status --short
git diff -- backend/staff frontend/src/pages/Staff
```

Confirm no uploaded test documents, credentials, absolute local paths, or unrelated user changes are staged.

- [ ] **Step 6: Commit any verification-only corrections**

If Step 2-5 required a correction:

```powershell
git add backend/staff/document_files.py backend/staff/models.py backend/staff/serializers.py backend/staff/views.py backend/staff/test_documents.py frontend/src/pages/Staff/AddStaff.jsx frontend/src/pages/Staff/AddStaff.css frontend/src/pages/Staff/staffDocuments.js frontend/src/pages/Staff/staffDocuments.test.js
git commit -m "fix: complete staff document verification"
```

If no correction was required, do not create an empty commit.
