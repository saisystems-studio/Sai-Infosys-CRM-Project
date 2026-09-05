import { useCallback, useEffect, useMemo, useState } from "react";
import "./InquiryList.css";
import {
  getCustomerInitials,
  getSourceName,
  getStatusTone,
} from "./inquiryPresentation";

/* =========================================================
   API CONFIGURATION
   ========================================================= */

const API_BASE = "/crm/api";

/* =========================================================
   ICON
   ========================================================= */

const Icon = ({ name, size = 14, className = "" }) => {
  const paths = {
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    phone: (
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67 A2 2 0 0 1 4.11 2h3 a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91 a16 16 0 0 0 6 6l1.27-1.27 a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 A2 2 0 0 1 22 16.92Z" />
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    box: (
      <>
        <path d="m21 8-9 5-9-5 9-5 9 5Z" />
        <path d="m3 8 9 5 9-5M12 13v9" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    hash: (
      <>
        <path d="M10 3 8 21M16 3l-2 18M4 9h16M3 15h16" />
      </>
    ),
    resource: (
      <>
        <circle cx="12" cy="7" r="3" />
        <path d="M5 21a7 7 0 0 1 14 0" />
      </>
    ),
    source: (
      <>
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="6" r="3" />
        <circle cx="18" cy="18" r="3" />
        <path d="m8.5 10.5 6.5-3M8.5 13.5l6.5 3" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16" />
        <path d="M9 7V4h6v3" />
        <path d="M7 7l1 13h8l1-13" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    close: <path d="M6 6l12 12M18 6 6 18" />,
    refresh: (
      <path d="M20 11a8 8 0 0 0-14.9-4M4 5v5h5M4 13a8 8 0 0 0 14.9 4M20 19v-5h-5" />
    ),
    chevronDown: <path d="m6 9 6 6 6-6" />,
    star: (
      <>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
};

/* =========================================================
   HELPERS
   ========================================================= */

const formatDate = (value) => {
  if (!value) return "—";
  const stringValue = String(value);
  let date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
    date = new Date(`${stringValue}T00:00:00`);
  } else {
    date = new Date(stringValue);
  }
  if (Number.isNaN(date.getTime())) {
    return stringValue;
  }
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatCurrency = (value) => {
  const amount = Number(value) || 0;
  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const getId = (item) =>
  item?.Id ?? item?.id ?? item?.inquiry_id ?? item?.inquiryId ?? "";

const getCustomerName = (item) =>
  item?.customer_name ||
  item?.customer?.customer_name ||
  item?.customer?.name ||
  "Unknown Customer";

const getCustomerPhone = (item) =>
  item?.phone_number ||
  item?.phone ||
  item?.customer_phone ||
  item?.customer?.phone_number ||
  item?.customer?.phone ||
  "";

const getCustomerEmail = (item) =>
  item?.email_id ||
  item?.email ||
  item?.customer_email ||
  item?.customer?.email_id ||
  item?.customer?.email ||
  "";

const getSerial = (item) =>
  item?.tally_serial_number ||
  item?.serial_number ||
  item?.customer?.tally_serial_number ||
  item?.customer?.serial ||
  item?.license?.tally_serial_number ||
  item?.licenses?.[0]?.tally_serial_number ||
  "";

const getStatusName = (item) =>
  item?.status_name ||
  item?.status_type_name ||
  item?.status?.status_type_name ||
  item?.status?.name ||
  "New";

const getRatingName = (item) =>
  item?.rating_name ||
  item?.rating_type_name ||
  item?.customer_rating_name ||
  item?.customer_rating?.rating_type_name ||
  item?.customer_rating?.name ||
  "";

const getResourceName = (item) =>
  item?.resource_name ||
  item?.resource?.resource_name ||
  item?.resource?.name ||
  item?.assigned_to_name ||
  item?.assigned_to ||
  "—";

const getResourceId = (item) =>
  item?.Resource_Id ??
  item?.resource_id ??
  item?.resource?.Id ??
  item?.resource?.id ??
  "";

const getScheduleDate = (item) =>
  item?.schedule_date || item?.scheduled_date || item?.follow_up_date || "";

const getCreatedDate = (item) =>
  item?.created_at ||
  item?.created_date ||
  item?.date ||
  item?.inquiry_date ||
  "";

const getProducts = (item) => {
  if (Array.isArray(item?.products)) return item.products;
  if (Array.isArray(item?.inquiry_products)) return item.inquiry_products;
  if (Array.isArray(item?.items)) return item.items;
  return [];
};

const getProductName = (product) =>
  product?.product_name ||
  product?.product_type_name ||
  product?.product?.product_type_name ||
  product?.product?.name ||
  product?.name ||
  "Product";

const getProductId = (product) =>
  product?.ProductType_Id ??
  product?.product_id ??
  product?.product?.Id ??
  product?.product?.id ??
  product?.product ??
  "";

const getProductQty = (product) => product?.qty ?? product?.quantity ?? 1;
const getProductRate = (product) => product?.rate ?? product?.price ?? 0;
const getProductRequirement = (product) =>
  product?.requirement || product?.remarks || product?.remark || "";

const getTotal = (item) => {
  if (item?.total !== undefined && item?.total !== null) {
    return Number(item.total) || 0;
  }
  return getProducts(item).reduce((sum, product) => {
    return (
      sum +
      (Number(getProductQty(product)) || 0) *
        (Number(getProductRate(product)) || 0)
    );
  }, 0);
};

/* =========================================================
   STATUS CLASS
   ========================================================= */

const getStatusClass = (status) => {
  return `status-${getStatusTone(status)}`;
};

/* =========================================================
   INQUIRY CARD
   ========================================================= */

function InquiryCard({
  inquiry,
  sources,
  onView,
  onEdit,
  onDelete,
  permissions,
}) {
  const inquiryId = getId(inquiry);
  const customerName = getCustomerName(inquiry);
  const phone = getCustomerPhone(inquiry);
  const email = getCustomerEmail(inquiry);
  const serial = getSerial(inquiry);
  const status = getStatusName(inquiry);
  const rating = getRatingName(inquiry);
  const resource = getResourceName(inquiry);
  const source = getSourceName(inquiry, sources);
  const scheduleDate = getScheduleDate(inquiry);
  const createdDate = getCreatedDate(inquiry);
  const products = getProducts(inquiry);
  const total = getTotal(inquiry);

  return (
    <article className="inquiry-card">
      <div className="card-header">
        <div className="customer-info">
          <div className="avatar" aria-hidden="true">
            {getCustomerInitials(customerName)}
          </div>
          <div>
            <span className="card-kicker">Inquiry #{inquiryId || "—"}</span>
            <h3>{customerName}</h3>
            <div className="contact">
              {email && (
                <span>
                  <Icon name="mail" size={10} />
                  {email}
                </span>
              )}
              {phone && (
                <span>
                  <Icon name="phone" size={10} />
                  {phone}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="badges">
          <span className={`status ${getStatusClass(status)}`}>
            <span className="dot" />
            {status}
          </span>
          {rating && <span className="rating">★ {rating}</span>}
        </div>
      </div>

      <div className="inquiry-card-meta">
        <div className="info-row">
          <div className="info-cell">
            <span className="label">Source</span>
            <span className="value">{source}</span>
          </div>
          <div className="info-cell">
            <span className="label">Tally Serial</span>
            <span className="value serial">{serial || "—"}</span>
          </div>
        </div>
        <div className="info-row">
          <div className="info-cell">
            <span className="label">Schedule</span>
            <span className="value">{formatDate(scheduleDate)}</span>
          </div>
          <div className="info-cell">
            <span className="label">Created</span>
            <span className="value">{formatDate(createdDate)}</span>
          </div>
        </div>
        <div className="info-row assigned-info-row">
          <div className="info-cell">
            <span className="label">Assigned to</span>
            <span className="value">{resource}</span>
          </div>
        </div>
      </div>

      <div className="products-section">
        <div className="products-header">
          <Icon name="box" size={10} />
          <span>Products & Requirements</span>
          <span className="count">{products.length}</span>
          <span className="products-estimate">
            <small>Est.</small>
            <strong>{formatCurrency(total)}</strong>
          </span>
        </div>

        {products.length > 0 ? (
          <div className="product-list">
            {products.slice(0, 2).map((product, index) => {
              const productName = getProductName(product);
              const quantity = getProductQty(product);
              const rate = getProductRate(product);
              const requirement = getProductRequirement(product);

              return (
                <div className="product-item" key={index}>
                  <div className="product-details">
                    <span className="product-name">{productName}</span>
                    <span className="product-qty">
                      × {Number(quantity).toFixed(2)}
                    </span>
                    {requirement && (
                      <span className="product-req">— {requirement}</span>
                    )}
                  </div>
                  <span className="product-total">
                    {formatCurrency(Number(quantity) * Number(rate))}
                  </span>
                </div>
              );
            })}
            {products.length > 2 && (
              <div className="product-more">+{products.length - 2} more</div>
            )}
          </div>
        ) : (
          <div className="no-products">No products</div>
        )}
      </div>

      <div className="card-footer">
        <div className="inquiry-id">
          <Icon name="clock" size={10} />
          <span>#{inquiryId || "—"}</span>
        </div>
        <div className="actions">
          {permissions.view && (
            <button
              className="action view"
              onClick={() => onView(inquiry)}
              title="View"
            >
              <Icon name="eye" size={12} />
            </button>
          )}
          {permissions.edit && (
            <button
              className="action edit"
              onClick={() => onEdit(inquiry)}
              title="Edit"
            >
              <Icon name="edit" size={12} />
            </button>
          )}
          {permissions.delete && (
            <button
              className="action delete"
              onClick={() => onDelete(inquiry)}
              title="Delete"
            >
              <Icon name="trash" size={12} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function InquiryDetailsModal({ inquiry, sources, onClose, onEdit, canEdit }) {
  const products = getProducts(inquiry);

  useEffect(() => {
    const handleKeyDown = (event) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="inquiry-modal-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="inquiry-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="inquiry-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="detail-modal-header">
          <div>
            <span>Inquiry #{getId(inquiry) || "—"}</span>
            <h2 id="inquiry-detail-title">{getCustomerName(inquiry)}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close inquiry details"
          >
            <Icon name="close" size={18} />
          </button>
        </header>

        <div className="detail-modal-body">
          <div className="detail-summary-grid">
            <div>
              <span>Phone</span>
              <strong>{getCustomerPhone(inquiry) || "—"}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{getCustomerEmail(inquiry) || "—"}</strong>
            </div>
            <div>
              <span>Tally serial</span>
              <strong>{getSerial(inquiry) || "—"}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{getStatusName(inquiry)}</strong>
            </div>
            <div>
              <span>Rating</span>
              <strong>{getRatingName(inquiry) || "—"}</strong>
            </div>
            <div>
              <span>Source</span>
              <strong>{getSourceName(inquiry, sources)}</strong>
            </div>
            <div>
              <span>Assigned to</span>
              <strong>{getResourceName(inquiry)}</strong>
            </div>
            <div>
              <span>Schedule date</span>
              <strong>{formatDate(getScheduleDate(inquiry))}</strong>
            </div>
            <div>
              <span>Created</span>
              <strong>{formatDate(getCreatedDate(inquiry))}</strong>
            </div>
          </div>

          <div className="detail-products">
            <div className="detail-section-title">
              <h3>Products and requirements</h3>
              <span>
                {products.length} item{products.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="detail-product-table">
              <div className="detail-product-row detail-product-head">
                <span>Product</span>
                <span>Requirement</span>
                <span>Qty</span>
                <span>Rate</span>
                <span>Amount</span>
              </div>
              {products.map((product, index) => {
                const qty = getProductQty(product);
                const rate = getProductRate(product);
                return (
                  <div className="detail-product-row" key={product.id ?? index}>
                    <strong>{getProductName(product)}</strong>
                    <span>{getProductRequirement(product) || "—"}</span>
                    <span>{qty}</span>
                    <span>{formatCurrency(rate)}</span>
                    <strong>
                      {formatCurrency(Number(qty) * Number(rate))}
                    </strong>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="detail-grand-total">
            <span>Estimated total</span>
            <strong>{formatCurrency(getTotal(inquiry))}</strong>
          </div>
        </div>

        <footer className="detail-modal-footer">
          <button type="button" className="detail-close-btn" onClick={onClose}>
            Close
          </button>
          {canEdit && (
            <button
              type="button"
              className="detail-edit-btn"
              onClick={() => onEdit(inquiry)}
            >
              <Icon name="edit" size={14} /> Edit inquiry
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
   ========================================================= */

function InquiryList({
  onAddInquiry,
  onViewInquiry,
  onEditInquiry,
  permissions = {},
}) {
  const [inquiries, setInquiries] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [sources, setSources] = useState([]);
  const [resources, setResources] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewInquiry, setViewInquiry] = useState(null);

  /* =======================================================
     TOKEN MANAGEMENT - FIXED
     ======================================================= */

  const getToken = useCallback(() => {
    // Try multiple storage locations
    let token =
      localStorage.getItem("crm_access_token") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("crm_access_token") ||
      sessionStorage.getItem("access_token");

    // Clean the token - remove quotes and trim
    if (token) {
      token = token.replace(/^"|"$/g, "").trim();
    }

    return token;
  }, []);

  const getHeaders = useCallback(() => {
    const token = getToken();

    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
      console.log("✅ Token being sent:", token.substring(0, 30) + "...");
    } else {
      console.warn("⚠️ No authentication token found!");
    }

    return headers;
  }, [getToken]);

  /* =======================================================
     REFRESH TOKEN
     ======================================================= */

  const refreshToken = useCallback(async () => {
    try {
      const refreshToken =
        localStorage.getItem("refresh_token") ||
        localStorage.getItem("crm_refresh_token");

      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      const response = await fetch(`${API_BASE}/token/refresh/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (!response.ok) {
        throw new Error("Token refresh failed");
      }

      const data = await response.json();

      // Store the new token
      localStorage.setItem("crm_access_token", data.access);
      if (data.refresh) {
        localStorage.setItem("refresh_token", data.refresh);
      }

      console.log("✅ Token refreshed successfully");
      return data.access;
    } catch (error) {
      console.error("Token refresh error:", error);
      // Clear tokens and redirect to login
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = "/crm/login";
      return null;
    }
  }, []);

  /* =======================================================
     LOAD INQUIRIES - WITH RETRY ON 401
     ======================================================= */

  const loadInquiries = useCallback(
    async (retryCount = 0) => {
      setLoading(true);
      setError("");

      try {
        const headers = getHeaders();

        console.log("📤 Sending request with headers:", {
          ...headers,
          Authorization: headers.Authorization ? "Bearer [HIDDEN]" : "None",
        });

        const response = await fetch(`${API_BASE}/inquiries/`, {
          method: "GET",
          headers: headers,
        });

        console.log("📥 Response status:", response.status);

        // Handle 401 Unauthorized
        if (response.status === 401) {
          if (retryCount < 2) {
            console.log("🔄 Token expired, attempting refresh...");
            const newToken = await refreshToken();
            if (newToken) {
              // Retry the request with new token
              return await loadInquiries(retryCount + 1);
            }
          }
          throw new Error("Authentication failed. Please login again.");
        }

        const text = await response.text();

        let data;
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          throw new Error(
            `Server returned invalid response. Status: ${response.status}`,
          );
        }

        if (!response.ok) {
          throw new Error(
            `Inquiry API failed: ${response.status} - ${data.detail || data.message || ""}`,
          );
        }

        const rows = Array.isArray(data)
          ? data
          : Array.isArray(data?.results)
            ? data.results
            : Array.isArray(data?.data)
              ? data.data
              : [];

        setInquiries(rows);
        setError("");
      } catch (err) {
        console.error("INQUIRY LIST ERROR:", err);
        setError(err.message || "Unable to load inquiries.");
        setInquiries([]);
      } finally {
        setLoading(false);
      }
    },
    [getHeaders, refreshToken],
  );

  /* =======================================================
     LOAD STATUS / SOURCE
     ======================================================= */

  useEffect(() => {
    const loadMasters = async () => {
      try {
        const headers = getHeaders();

        const [statusResponse, sourceResponse, resourceResponse, productResponse] = await Promise.all([
          fetch(`${API_BASE}/status-types/`, { headers }),
          fetch(`${API_BASE}/source-types/`, { headers }),
          fetch(`${API_BASE}/inquiries/resources/`, { headers }),
          fetch(`${API_BASE}/product-types/`, { headers }),
        ]);

        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          setStatuses(Array.isArray(statusData) ? statusData : []);
        }

        if (sourceResponse.ok) {
          const sourceData = await sourceResponse.json();
          setSources(Array.isArray(sourceData) ? sourceData : []);
        }

        if (resourceResponse.ok) {
          const resourceData = await resourceResponse.json();
          setResources(Array.isArray(resourceData) ? resourceData : []);
        }

        if (productResponse.ok) {
          const productData = await productResponse.json();
          setProducts(Array.isArray(productData) ? productData : []);
        }
      } catch (err) {
        console.error("STATUS/SOURCE MASTER ERROR:", err);
      }
    };

    loadMasters();
  }, [getHeaders]);

  /* =======================================================
     INITIAL LOAD
     ======================================================= */

  useEffect(() => {
    loadInquiries();
  }, [loadInquiries]);

  /* =======================================================
     FILTER
     ======================================================= */

  const filteredInquiries = useMemo(() => {
    const searchValue = search.trim().toLowerCase();

    return inquiries.filter((inquiry) => {
      const customerName = getCustomerName(inquiry).toLowerCase();
      const phone = getCustomerPhone(inquiry).toLowerCase();
      const email = getCustomerEmail(inquiry).toLowerCase();
      const serial = getSerial(inquiry).toLowerCase();
      const inquiryId = String(getId(inquiry)).toLowerCase();
      const status = getStatusName(inquiry).toLowerCase();

      const matchesSearch =
        !searchValue ||
        customerName.includes(searchValue) ||
        phone.includes(searchValue) ||
        email.includes(searchValue) ||
        serial.includes(searchValue) ||
        inquiryId.includes(searchValue);

      const matchesStatus =
        !statusFilter ||
        String(
          inquiry?.Status_Id ??
            inquiry?.status_id ??
            inquiry?.status?.Id ??
            inquiry?.status?.id ??
            "",
        ) === String(statusFilter) ||
        status === String(statusFilter).toLowerCase();

      const matchesResource =
        !resourceFilter ||
        String(getResourceId(inquiry)) === String(resourceFilter);

      const matchesProduct =
        !productFilter ||
        getProducts(inquiry).some(
          (product) => String(getProductId(product)) === String(productFilter),
        );

      return (
        matchesSearch &&
        matchesStatus &&
        matchesResource &&
        matchesProduct
      );
    });
  }, [
    inquiries,
    search,
    statusFilter,
    resourceFilter,
    productFilter,
  ]);

  /* =======================================================
     STATISTICS
     ======================================================= */

  const stats = useMemo(() => {
    const total = inquiries.length;
    const newCount = inquiries.filter((i) =>
      getStatusName(i).toLowerCase().includes("new"),
    ).length;
    const progressCount = inquiries.filter((i) =>
      getStatusName(i).toLowerCase().includes("progress"),
    ).length;
    const completedCount = inquiries.filter((i) =>
      getStatusName(i).toLowerCase().includes("complete"),
    ).length;

    return { total, newCount, progressCount, completedCount };
  }, [inquiries]);

  const handleStatFilter = (statusKeyword = "") => {
    if (!statusKeyword) {
      setStatusFilter("");
      return;
    }

    const matchingStatus = statuses.find((status) =>
      String(status.status_type_name || "")
        .toLowerCase()
        .includes(statusKeyword),
    );

    setStatusFilter(matchingStatus ? String(matchingStatus.Id) : statusKeyword);
  };

  /* =======================================================
     DELETE
     ======================================================= */

  const handleDelete = async (inquiry) => {
    const inquiryId = getId(inquiry);
    if (!inquiryId) {
      alert("Inquiry ID not found.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete Inquiry #${inquiryId}?`,
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`${API_BASE}/inquiries/${inquiryId}/`, {
        method: "DELETE",
        headers: getHeaders(),
      });

      if (response.status === 401) {
        // Try to refresh token and retry
        const newToken = await refreshToken();
        if (newToken) {
          const retryResponse = await fetch(
            `${API_BASE}/inquiries/${inquiryId}/`,
            {
              method: "DELETE",
              headers: getHeaders(),
            },
          );
          if (!retryResponse.ok) {
            throw new Error(`Delete failed: ${retryResponse.status}`);
          }
        } else {
          throw new Error("Authentication failed. Please login again.");
        }
      } else if (!response.ok) {
        throw new Error(`Delete failed: ${response.status}`);
      }

      setInquiries((rows) =>
        rows.filter((row) => String(getId(row)) !== String(inquiryId)),
      );
    } catch (err) {
      console.error("DELETE INQUIRY ERROR:", err);
      alert(err.message || "Unable to delete inquiry.");
    }
  };

  const handleView = (inquiry) => {
    setViewInquiry(inquiry);
    if (onViewInquiry) {
      onViewInquiry(inquiry);
    }
  };

  const handleEdit = (inquiry) => {
    if (onEditInquiry) {
      onEditInquiry(inquiry);
      return;
    }
    console.log("EDIT INQUIRY:", inquiry);
  };

  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div className="inquiry-list">
      {/* Header */}
      <div className="list-header">
        <div className="header-left">
          <div className="breadcrumb">CRM WORKSPACE / INQUIRIES</div>
        </div>
        {permissions.add && (
          <button className="add-btn" onClick={onAddInquiry}>
            New inquiry
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-item">
          <span className="stat-icon">📊</span>
          <span className="stat-label">Total</span>
          <button
            type="button"
            className="stat-value stat-value-button"
            onClick={() => handleStatFilter()}
            title="Show all inquiries"
          >
            {stats.total}
          </button>
        </div>
        <div className="stat-item">
          <span className="stat-icon">🆕</span>
          <span className="stat-label">New</span>
          <button
            type="button"
            className="stat-value stat-value-button"
            onClick={() => handleStatFilter("new")}
            title="Show new inquiries"
          >
            {stats.newCount}
          </button>
        </div>
        <div className="stat-item">
          <span className="stat-icon">⏳</span>
          <span className="stat-label">Progress</span>
          <button
            type="button"
            className="stat-value stat-value-button"
            onClick={() => handleStatFilter("progress")}
            title="Show inquiries in progress"
          >
            {stats.progressCount}
          </button>
        </div>
        <div className="stat-item">
          <span className="stat-icon">✅</span>
          <span className="stat-label">Completed</span>
          <button
            type="button"
            className="stat-value stat-value-button"
            onClick={() => handleStatFilter("complete")}
            title="Show completed inquiries"
          >
            {stats.completedCount}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="search-wrapper">
          <Icon name="search" size={14} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer, phone, email, serial..."
          />
          {search && (
            <button className="clear-btn" onClick={() => setSearch("")}>
              ×
            </button>
          )}
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-select"
        >
          <option value="">All Status</option>
          {statuses.map((status) => (
            <option key={status.Id} value={status.Id}>
              {status.status_type_name}
            </option>
          ))}
        </select>

        <select
          value={resourceFilter}
          onChange={(e) => setResourceFilter(e.target.value)}
          className="filter-select"
        >
          <option value="">All Resources</option>
          {resources.map((resource) => (
            <option key={resource.Id} value={resource.Id}>
              {resource.Full_Name}
            </option>
          ))}
        </select>

        <select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="filter-select"
        >
          <option value="">All Products</option>
          {products.map((product) => (
            <option key={product.Id} value={product.Id}>
              {product.product_type_name}
            </option>
          ))}
        </select>

        <button
          className="refresh-btn"
          onClick={() => loadInquiries()}
          disabled={loading}
        >
          <Icon name="refresh" size={14} />
        </button>
      </div>

      {/* Summary */}
      {!loading && !error && (
        <div className="list-summary">
          <span>
            Showing <strong>{filteredInquiries.length}</strong> of{" "}
            <strong>{inquiries.length}</strong> inquiries
          </span>
          {(search || statusFilter || resourceFilter || productFilter) && (
            <button
              className="clear-filters"
              onClick={() => {
                setSearch("");
                setStatusFilter("");
                setResourceFilter("");
                setProductFilter("");
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="error-state">
          <span>❌ {error}</span>
          <button onClick={() => loadInquiries()}>Try Again</button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="loading-state">
          <div className="spinner" />
          <span>Loading inquiries...</span>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filteredInquiries.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">
            <Icon name="box" size={24} />
          </div>
          <h3>No inquiries found</h3>
          <p>
            {inquiries.length === 0
              ? "There are no customer inquiries yet."
              : "Try changing your search or filters."}
          </p>
          {inquiries.length === 0 && permissions.add && (
            <button onClick={onAddInquiry}>
              <Icon name="plus" size={14} />
              Add New Inquiry
            </button>
          )}
        </div>
      )}

      {/* Cards */}
      {!loading && !error && filteredInquiries.length > 0 && (
        <div className="card-grid">
          {filteredInquiries.map((inquiry) => (
            <InquiryCard
              key={getId(inquiry)}
              inquiry={inquiry}
              sources={sources}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              permissions={permissions}
            />
          ))}
        </div>
      )}
      {viewInquiry && (
        <InquiryDetailsModal
          inquiry={viewInquiry}
          sources={sources}
          onClose={() => setViewInquiry(null)}
          onEdit={(inquiry) => {
            setViewInquiry(null);
            handleEdit(inquiry);
          }}
          canEdit={permissions.edit}
        />
      )}
    </div>
  );
}

export default InquiryList;
