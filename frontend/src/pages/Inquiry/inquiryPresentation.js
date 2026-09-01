export function getCustomerInitials(name = "") {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "CU";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

export function getStatusTone(status = "") {
  const value = String(status).toLowerCase();
  if (value.includes("progress")) return "progress";
  if (value.includes("follow")) return "follow";
  if (value.includes("closed")) return "closed";
  if (value.includes("complete")) return "completed";
  if (value.includes("cancel")) return "cancelled";
  if (value.includes("new")) return "new";
  return "default";
}

export function getSourceName(item, sources = []) {
  const directName =
    item?.source_name ||
    item?.source_type_name ||
    item?.source?.source_type_name ||
    item?.source?.name;

  if (directName) return directName;

  const sourceId =
    item?.source_id ??
    item?.Source_Id ??
    item?.source?.Id ??
    item?.source?.id;
  const source = sources.find(
    (candidate) => String(candidate?.Id ?? candidate?.id) === String(sourceId),
  );

  return source?.source_type_name || source?.name || "—";
}
