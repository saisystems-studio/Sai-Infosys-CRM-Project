import { useEffect, useState } from "react";
import axios from "axios";
import "./ViewCustomer.css";
import { paginateItems } from "./customerViewPagination";

// Configure axios with token interceptor
const api = axios.create({
  baseURL: "/crm/api/",
});

// Add token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

export default function ViewCustomer({ customerId, onClose }) {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customerTypes, setCustomerTypes] = useState([]);
  const [ratingTypes, setRatingTypes] = useState([]);
  const [licenseTypes, setLicenseTypes] = useState([]);
  const [activeTab, setActiveTab] = useState("customer");
  const [contactPage, setContactPage] = useState(1);
  const [licensePage, setLicensePage] = useState(1);

  useEffect(() => {
    if (!customerId) return;

    api
      .get(`customers/${customerId}/`)
      .then((response) => setCustomer(response.data))
      .catch((error) => {
        console.error("Error loading customer:", error);
        setError("Failed to load customer details");
      })
      .finally(() => setLoading(false));

    Promise.all([
      api.get("customer-types/"),
      api.get("rating-types/"),
      api.get("license-types/"),
    ])
      .then(([typesRes, ratingsRes, licensesRes]) => {
        setCustomerTypes(typesRes.data);
        setRatingTypes(ratingsRes.data);
        setLicenseTypes(licensesRes.data);
      })
      .catch((error) => console.error("Error loading dropdown data:", error));
  }, [customerId]);

  // Helper function to get customer type name by ID
  const getCustomerTypeName = (typeId) => {
    if (!typeId) return "-";
    const type = customerTypes.find((t) => t.Id === typeId);
    return type ? type.customer_type_name : typeId;
  };

  // Helper function to get rating type name by ID
  const getRatingTypeName = (ratingId) => {
    if (!ratingId) return "-";
    const rating = ratingTypes.find((r) => r.Id === ratingId);
    return rating ? rating.rating_type_name : ratingId;
  };

  // Helper function to get license type name by ID
  const getLicenseTypeName = (licenseId) => {
    if (!licenseId) return "-";
    const type = licenseTypes.find((t) => t.Id === licenseId);
    return type ? type.license_type_name : licenseId;
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="view-customer-overlay">
        <div className="view-customer-dialog">
          <div className="loading-shimmer">
            <div className="spinner"></div>
            <p>Loading customer details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="view-customer-overlay">
        <div className="view-customer-dialog">
          <div className="error-state">
            <span className="error-icon">❌</span>
            <p>{error || "Customer not found"}</p>
            <button className="view-customer-close-action" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const customerHeading = (() => {
    const customerName = customer.customer_name?.trim();
    const companyName = customer.company_name?.trim();

    if (customerName && companyName) {
      return `${customerName} - ${companyName}`;
    }

    return customerName || companyName || "Customer";
  })();

  const contacts = paginateItems(customer.contacts, contactPage, 4);
  const licenses = paginateItems(customer.licenses, licensePage, 4);

  const changeTab = (tab) => {
    setActiveTab(tab);
    setContactPage(1);
    setLicensePage(1);
  };

  const renderPagination = (pagination, setPage) =>
    pagination.pageCount > 1 ? (
      <div className="view-pagination" aria-label="Pagination">
        <button
          type="button"
          disabled={pagination.page === 1}
          onClick={() => setPage((page) => page - 1)}
        >
          Previous
        </button>
        <span>
          Page {pagination.page} of {pagination.pageCount}
        </span>
        <button
          type="button"
          disabled={pagination.page === pagination.pageCount}
          onClick={() => setPage((page) => page + 1)}
        >
          Next
        </button>
      </div>
    ) : null;

  return (
    <div className="view-customer-overlay" onClick={onClose}>
      <div className="view-customer-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="view-customer-header">
          <div className="view-customer-header-info">
            <h2>{customerHeading}</h2>
          </div>
          <button className="view-customer-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="view-tabs" role="tablist" aria-label="Customer details">
          <button
            type="button"
            className={activeTab === "customer" ? "active" : ""}
            onClick={() => changeTab("customer")}
          >
            Customer Information
          </button>
          <button
            type="button"
            className={activeTab === "contacts" ? "active" : ""}
            onClick={() => changeTab("contacts")}
          >
            Contacts
          </button>
          {customer.licenses && customer.licenses.length > 0 && (
            <button
              type="button"
              className={activeTab === "licenses" ? "active" : ""}
              onClick={() => changeTab("licenses")}
            >
              Licences
            </button>
          )}
        </div>

        <div className="view-customer-body view-tab-body">
          {/* Customer Information Section */}
          {activeTab === "customer" && (
            <div className="view-section">
              <div className="info-grid">
                <div className="info-item">
                  <label>Customer Code</label>
                  <span className="info-value">
                    {customer.customer_code || "-"}
                  </span>
                </div>

                <div className="info-item">
                  <label>Customer Name</label>
                  <span className="info-value">
                    {customer.customer_name || "-"}
                  </span>
                </div>

                <div className="info-item">
                  <label>Company Name</label>
                  <span className="info-value">
                    {customer.company_name || "-"}
                  </span>
                </div>

                <div className="info-item">
                  <label>Email ID</label>
                  <span className="info-value">{customer.email_id || "-"}</span>
                </div>

                <div className="info-item">
                  <label>Customer Type</label>
                  <span className="info-value">
                    {getCustomerTypeName(customer.customer_type)}
                  </span>
                </div>

                <div className="info-item">
                  <label>Customer Rating</label>
                  <span className="info-value">
                    {getRatingTypeName(customer.customer_rating)}
                  </span>
                </div>

                <div className="info-item">
                  <label>Address</label>
                  <span className="info-value">{customer.address || "-"}</span>
                </div>

                <div className="info-item">
                  <label>City</label>
                  <span className="info-value">{customer.city || "-"}</span>
                </div>

                <div className="info-item">
                  <label>GST Number</label>
                  <span className="info-value">
                    {customer.gst_number || "-"}
                  </span>
                </div>

                <div className="info-item full-width">
                  <label>Notes</label>
                  <span className="info-value">{customer.notes || "-"}</span>
                </div>
              </div>
            </div>
          )}

          {/* Contact Details Section */}
          {activeTab === "contacts" && (
            <div className="view-section">
              {customer.contacts && customer.contacts.length > 0 ? (
                <div className="contact-list">
                  {contacts.items.map((contact, index) => {
                    const phoneNumber = contact.contact_number || "";
                    const normalizedPhone = phoneNumber.replace(/\s+/g, "");

                    return (
                      <div
                        key={contact.id || index}
                        className="contact-item-view"
                      >
                        <div className="contact-info">
                          <span className="contact-label">Contact Person</span>
                          <span className="contact-value">
                            {contact.contact_name || "-"}
                          </span>
                        </div>
                        <div className="contact-info">
                          <span className="contact-label">Contact Number</span>
                          {phoneNumber ? (
                            <a
                              href={`tel:${normalizedPhone}`}
                              className="contact-value contact-call-link"
                            >
                              {phoneNumber}
                            </a>
                          ) : (
                            <span className="contact-value">-</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-message">No contacts available</div>
              )}
              {renderPagination(contacts, setContactPage)}
            </div>
          )}

          {/* License Details Section */}
          {activeTab === "licenses" && (
            <div className="view-section">
              {customer.licenses && customer.licenses.length > 0 ? (
                <div className="license-list">
                  {licenses.items.map((license, index) => (
                    <div
                      key={license.id || index}
                      className="license-item-view"
                    >
                      <div className="license-info">
                        <span className="license-label">
                          Tally Serial Number
                        </span>
                        <span className="license-value">
                          {license.tally_serial_number || "-"}
                        </span>
                      </div>
                      <div className="license-info">
                        <span className="license-label">License Type</span>
                        <span className="license-value">
                          {getLicenseTypeName(license.license_type)}
                        </span>
                      </div>
                      <div className="license-info">
                        <span className="license-label">Admin ID</span>
                        <span className="license-value">
                          {license.admin_id || "-"}
                        </span>
                      </div>
                      <div className="license-info">
                        <span className="license-label">Expiry Date</span>
                        <span className="license-value">
                          {formatDate(license.expiry_date)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-message">No licenses available</div>
              )}
              {renderPagination(licenses, setLicensePage)}
            </div>
          )}
        </div>

        <div className="view-customer-footer">
          <button className="view-customer-close-action" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
