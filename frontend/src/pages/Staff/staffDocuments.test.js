import test from "node:test";
import assert from "node:assert/strict";

import {
  appendStaffDocuments,
  formatDocumentSize,
  getStaffEditAssets,
  removePendingDocument,
  resolveStaffMediaUrl,
  validateStaffDocuments,
} from "./staffDocuments.js";

test("staff document selection accepts multiple supported files", () => {
  const files = [
    { name: "contract.pdf", size: 100, type: "application/pdf" },
    { name: "photo.png", size: 200, type: "image/png" },
  ];

  assert.deepEqual(validateStaffDocuments(files), {
    accepted: files,
    errors: [],
  });
});

test("staff document selection rejects unsupported and oversized files", () => {
  const result = validateStaffDocuments([
    { name: "script.exe", size: 100, type: "application/octet-stream" },
    {
      name: "large.pdf",
      size: 10 * 1024 * 1024 + 1,
      type: "application/pdf",
    },
  ]);

  assert.equal(result.accepted.length, 0);
  assert.equal(result.errors.length, 2);
});

test("staff documents use repeated multipart fields", () => {
  const entries = [];
  const formData = {
    append: (key, value) => entries.push([key, value]),
  };

  appendStaffDocuments(formData, ["first", "second"]);

  assert.deepEqual(entries, [
    ["Staff_Documents", "first"],
    ["Staff_Documents", "second"],
  ]);
});

test("pending document removal preserves other files", () => {
  assert.deepEqual(removePendingDocument(["a", "b", "c"], 1), ["a", "c"]);
});

test("document sizes are formatted for display", () => {
  assert.equal(formatDocumentSize(800), "1 KB");
  assert.equal(formatDocumentSize(1572864), "1.5 MB");
});

test("edit mode preserves absolute staff image URLs", () => {
  const imageUrl = "http://127.0.0.1:8000/uploads/staff/photo.png";
  assert.equal(resolveStaffMediaUrl(imageUrl, "/crm/api"), imageUrl);
});

test("edit mode resolves Django media paths without duplicating uploads", () => {
  assert.equal(
    resolveStaffMediaUrl("/uploads/staff/photo.png", "/crm/api"),
    "http://127.0.0.1:8000/uploads/staff/photo.png",
  );
  assert.equal(
    resolveStaffMediaUrl("staff/photo.png", "/crm/api"),
    "http://127.0.0.1:8000/uploads/staff/photo.png",
  );
});

test("edit mode hydrates the saved photo and document list", () => {
  const documents = [{ Id: 1, Original_Name: "contract.pdf" }];
  assert.deepEqual(
    getStaffEditAssets(
      { Staff_Image: "/uploads/staff/photo.png", Documents: documents },
      "/crm/api",
    ),
    {
      imagePreview: "http://127.0.0.1:8000/uploads/staff/photo.png",
      documents,
    },
  );
});
