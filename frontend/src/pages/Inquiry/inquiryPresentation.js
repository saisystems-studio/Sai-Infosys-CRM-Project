export function getCustomerInitials(name = "") {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "CU";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

export function getInquiryDisplayName(item) {
  return (
    item?.company_name ||
    item?.customer?.company_name ||
    item?.customer_name ||
    item?.customer?.customer_name ||
    item?.customer?.name ||
    "Unknown Customer"
  );
}

export function getInquiryCreatedDate(item) {
  return (
    item?.created_at ||
    item?.created_date ||
    item?.date ||
    item?.inquiry_date ||
    ""
  );
}

function asLocalDate(value) {
  const stringValue = String(value || "");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(stringValue)
    ? new Date(`${stringValue}T00:00:00`)
    : new Date(stringValue);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date) {
  const result = startOfDay(date);
  result.setDate(result.getDate() + 1);
  result.setMilliseconds(-1);
  return result;
}

export function filterInquiriesByCreatedPeriod(inquiries, period, now = new Date()) {
  if (!period) return inquiries;

  const today = startOfDay(now);
  let start = today;
  let end = endOfDay(now);

  if (period === "yesterday") {
    start = new Date(today);
    start.setDate(start.getDate() - 1);
    end = endOfDay(start);
  } else if (period === "yesterday-and-today") {
    start = new Date(today);
    start.setDate(start.getDate() - 1);
  } else if (period === "last-7-days") {
    start = new Date(today);
    start.setDate(start.getDate() - 6);
  } else if (period === "this-month") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (period === "last-month") {
    start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    end = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
  } else if (period === "next-month") {
    start = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    end = new Date(today.getFullYear(), today.getMonth() + 2, 0, 23, 59, 59, 999);
  }

  return inquiries.filter((inquiry) => {
    const createdDate = asLocalDate(getInquiryCreatedDate(inquiry));
    return createdDate && createdDate >= start && createdDate <= end;
  });
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

export function getInquiryFilterFallbackOptions(inquiries = []) {
  const statuses = new Map();
  const resources = new Map();
  const products = new Map();

  inquiries.forEach((inquiry) => {
    const statusId = inquiry?.Status_Id ?? inquiry?.status_id ?? inquiry?.status?.Id;
    const statusName = inquiry?.status_name || inquiry?.status_type_name || inquiry?.status?.status_type_name;
    if (statusId != null && statusName) {
      statuses.set(String(statusId), { Id: statusId, status_type_name: statusName });
    }

    const resourceId = inquiry?.Resource_Id ?? inquiry?.resource_id ?? inquiry?.resource?.Id;
    const resourceName = inquiry?.resource_name || inquiry?.resource?.Full_Name || inquiry?.resource?.name;
    if (resourceId != null && resourceName) {
      resources.set(String(resourceId), { Id: resourceId, Full_Name: resourceName });
    }

    const inquiryProducts = Array.isArray(inquiry?.products)
      ? inquiry.products
      : Array.isArray(inquiry?.inquiry_products) ? inquiry.inquiry_products : [];
    inquiryProducts.forEach((product) => {
      const productId = product?.ProductType_Id ?? product?.product_id ?? product?.product?.Id;
      const productName = product?.product_name || product?.product_type_name || product?.product?.product_type_name || product?.name;
      if (productId != null && productName) {
        products.set(String(productId), { Id: productId, product_type_name: productName });
      }
    });
  });

  return {
    statuses: [...statuses.values()].sort((left, right) => left.status_type_name.localeCompare(right.status_type_name)),
    resources: [...resources.values()].sort((left, right) => left.Full_Name.localeCompare(right.Full_Name)),
    products: [...products.values()].sort((left, right) => left.product_type_name.localeCompare(right.product_type_name)),
  };
}
