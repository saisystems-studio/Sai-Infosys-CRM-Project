export const MAX_STAFF_DOCUMENT_BYTES = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  "pdf", "doc", "docx", "xls", "xlsx", "txt", "csv",
  "jpg", "jpeg", "png", "webp",
]);

export function validateStaffDocuments(files) {
  const accepted = [];
  const errors = [];

  Array.from(files || []).forEach((file) => {
    const extension = file.name?.split(".").pop()?.toLowerCase();
    if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
      errors.push(`${file.name}: unsupported file type.`);
    } else if (file.size > MAX_STAFF_DOCUMENT_BYTES) {
      errors.push(`${file.name}: file must be 10 MB or smaller.`);
    } else {
      accepted.push(file);
    }
  });

  return { accepted, errors };
}

export function appendStaffDocuments(formData, documents) {
  documents.forEach((document) => formData.append("Staff_Documents", document));
}

export function removePendingDocument(documents, index) {
  return documents.filter((_, documentIndex) => documentIndex !== index);
}

export function formatDocumentSize(bytes = 0) {
  if (bytes < 1024) return "1 KB";
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`;
}

export function resolveStaffMediaUrl(imagePath, apiUrl) {
  if (!imagePath) return "";
  if (/^https?:\/\//i.test(imagePath)) return imagePath;

  const baseUrl = String(apiUrl || "").replace(/\/api\/?$/, "");
  const cleanPath = String(imagePath).replace(/^\/+/, "");
  const mediaPath = cleanPath.startsWith("uploads/")
    ? cleanPath
    : `uploads/${cleanPath}`;
  return `${baseUrl}/${mediaPath}`;
}

export function getStaffEditAssets(staffData, apiUrl) {
  return {
    imagePreview: resolveStaffMediaUrl(staffData?.Staff_Image, apiUrl),
    documents: Array.isArray(staffData?.Documents) ? staffData.Documents : [],
  };
}
