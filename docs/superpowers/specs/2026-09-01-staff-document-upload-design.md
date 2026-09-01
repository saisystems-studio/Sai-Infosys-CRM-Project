# Staff Document Upload Design

## Purpose

Add secure multi-document storage to Add Staff and Edit Staff. Each document belongs to one staff member, is stored under the project's configured media directory, and has searchable metadata in a separate database table.

## Scope

This change adds document selection, upload, listing, download, and individual removal to the existing staff workflow. It does not add document versioning, folders, sharing, document content search, or external cloud storage.

## Data Model

Create `StaffDocument` mapped to `StaffDocument_tbl` with these fields:

- `Id`: primary key.
- `Staff_Id`: foreign key to `StaffDetails_tbl.Id`, using `CASCADE` and the related name `Documents`.
- `Document_File`: file field containing the relative stored path.
- `Original_Name`: filename supplied by the user, stored for display.
- `Mime_Type`: validated MIME type reported for the upload.
- `File_Size`: size in bytes.
- `Uploaded_By`: nullable foreign key to the authenticated Django user using `SET_NULL`.
- `Uploaded_On`: automatically populated timestamp.

The database stores relative media paths rather than absolute machine paths. Files use a generated collision-resistant stored name under `uploads/staff/documents/<staff-id>/`.

Deleting a staff member cascades to document rows. Model/service deletion hooks remove the corresponding physical files. Deleting one document removes its row and physical file. File cleanup must never target a directory outside the configured media root.

## Supported Files and Validation

Each file has a maximum size of 10 MB. Accepted formats are:

- PDF
- DOC and DOCX
- XLS and XLSX
- TXT and CSV
- JPG and JPEG
- PNG
- WEBP

Validation checks file size, normalized extension, and MIME type. Executable, script, archive, and unrecognized formats are rejected. Filenames are treated as display metadata only and never used directly as the stored filesystem name.

The backend is authoritative. Frontend validation provides immediate feedback but cannot replace server validation.

## API and Serialization

Extend staff responses with a read-only `Documents` array. Each entry contains its ID, original filename, MIME type, byte size, upload timestamp, and media URL.

The existing Add/Edit Staff requests remain `multipart/form-data`. New files are repeated under a `Staff_Documents` form key. Existing photo and menu-permission fields retain their current behavior.

Staff creation performs these steps:

1. Validate staff fields and every uploaded document.
2. Create the Django user and staff row inside the existing transaction boundary.
3. Save document rows linked to the new staff record.
4. If the database operation fails, remove files written by that request.

Staff update appends newly uploaded documents and leaves existing documents unchanged unless they are explicitly removed.

Add a staff-document delete action scoped by staff and document ID. It uses the same staff-management edit permission as editing staff. A download/view URL is read-only and available only to authenticated users with staff-list view permission. The server must not accept a document ID belonging to another staff record through the nested route.

## Frontend Experience

Add a compact document panel beside the existing staff photo section.

- The picker supports multiple selection and drag/drop.
- Before save, each selected file shows its name, type, formatted size, and a remove button.
- Invalid files show a specific size or format message and are not added.
- Edit Staff also lists stored documents with View/Download and Delete actions.
- Deleting a stored document requires confirmation and updates the list only after the API succeeds.
- Upload progress is represented by the existing form saving state; per-file progress is outside scope.
- On a failed staff save, selected valid files remain selected so the user can correct other fields and retry.

The layout stacks below the photo on narrow screens and preserves the current Personal Details card styling.

## Error Handling and Cleanup

- A validation response identifies the offending filename and reason.
- A failed document delete leaves the UI item visible and shows the backend error.
- Missing physical files do not prevent removal of stale database rows.
- Replacing or removing a staff photo remains independent from document operations.
- File cleanup is restricted to resolved paths inside `MEDIA_ROOT`.

## Permissions

Document upload and deletion follow the existing Add Staff/Edit Staff permissions. Document metadata and downloads follow Staff List view permission. No new menu entry or permission type is introduced.

## Testing

Backend tests cover:

- Multiple valid documents saved against one staff foreign key.
- Stored metadata and relative paths.
- The 10 MB boundary and oversized rejection.
- Accepted extensions/MIME types and unsafe-format rejection.
- Staff create rollback cleanup.
- Appending documents during edit.
- Individual document deletion and physical-file cleanup.
- Staff cascade deletion and physical-file cleanup.
- Cross-staff document ID protection and menu permissions.

Frontend tests cover:

- Multi-file selection and metadata presentation.
- Format and 10 MB validation.
- Removing a pending selection.
- Appending repeated `Staff_Documents` multipart fields.
- Rendering existing document metadata.

Verification includes Django migrations/tests, the complete frontend test suite, linting of changed files, and a production frontend build.
