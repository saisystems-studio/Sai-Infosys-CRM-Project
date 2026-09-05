import { normalizeTallySerialNumber } from "./customerLicenses.js";
import { useEffect, useState } from "react";
import axios from "axios";
import { getRequiredCustomerErrors } from "./customerValidation.js";
import { getContactNumberError } from "./customerContacts.js";
import { getLicenseErrors, prepareLicensesForPayload } from "./customerLicenses.js";
import "./AddCustomer.css";
import { createCustomerUpdatedHandler } from "./customerNavigation.js";

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
  (error) => Promise.reject(error),
);

export default function EditCustomer({ customerId, onClose, onUpdate }) {
  const handleUpdated = createCustomerUpdatedHandler(onUpdate);
  // Customer Details State
  const [customerData, setCustomerData] = useState({
    customer_code: "",
    customer_name: "",
    company_name: "",
    email_id: "",
    customer_type: "",
    address: "",
    pincode: "",
    city: "",
    state: "",
    country: "",
    gst_number: "",
    customer_rating: "",
    notes: "",
  });

  // Contacts State
  const [contacts, setContacts] = useState([
    {
      id: Date.now(),
      contact_name: "",
      contact_number: "",
    },
  ]);

  // Licenses State
  const [licenses, setLicenses] = useState([
    {
      id: Date.now(),
      tally_serial_number: "",
      license_type: "",
      admin_id: "",
      expiry_date: "",
    },
  ]);

  // Collapsible sections state
  const [sections, setSections] = useState({
    contacts: true,
    licenses: true,
  });

  // Dropdown options
  const [customerTypes, setCustomerTypes] = useState([]);
  const [ratingTypes, setRatingTypes] = useState([]);
  const [licenseTypes, setLicenseTypes] = useState([]);

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Load customer data and dropdowns
  useEffect(() => {
    if (customerId) {
      loadCustomerData();
      loadDropdownData();
    }
  }, [customerId]);

  // Auto-hide success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Load dropdown data
  const loadDropdownData = async () => {
    try {
      const [typesRes, ratingsRes, licensesRes] = await Promise.all([
        api.get("customer-types/"),
        api.get("rating-types/"),
        api.get("license-types/"),
      ]);
      setCustomerTypes(typesRes.data);
      setRatingTypes(ratingsRes.data);
      setLicenseTypes(licensesRes.data);
    } catch (error) {
      console.error("Error loading dropdown data:", error);
      if (error.response?.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/crm/login";
      }
    }
  };

  // Load customer data
  const loadCustomerData = async () => {
    try {
      setLoadingData(true);
      const response = await api.get(`customers/${customerId}/`);
      const customer = response.data;

      const normalizeList = (value) => {
        if (Array.isArray(value)) return value;
        if (value && typeof value === "object") return [value];
        return [];
      };

      const getMasterId = (value) => {
        if (!value) return "";
        if (typeof value === "object") return value.Id ?? value.id ?? "";
        return value;
      };

      const contactList = normalizeList(
        customer.contacts ??
          customer.contact_details ??
          customer.contactDetails,
      );

      const licenseList = normalizeList(
        customer.licenses ??
          customer.license_details ??
          customer.licenseDetails,
      );

      setCustomerData({
        customer_code: customer.customer_code || "",
        customer_name: customer.customer_name || "",
        company_name: customer.company_name || "",
        email_id: customer.email_id || "",
        customer_type: getMasterId(customer.customer_type),
        address: customer.address || "",
        pincode: customer.pincode || "",
        city: customer.city || "",
        state: customer.state || "",
        country: customer.country || "",
        gst_number: customer.gst_number || "",
        customer_rating: getMasterId(customer.customer_rating),
        notes: customer.notes || "",
      });

      setContacts(
        contactList.length > 0
          ? contactList.map((contact) => ({
              id: contact.id || Date.now() + Math.random(),
              contact_name: contact.contact_name || "",
              contact_number: contact.contact_number || "",
              _isExisting: true,
            }))
          : [{ id: Date.now(), contact_name: "", contact_number: "" }],
      );

      setLicenses(
        licenseList.length > 0
          ? licenseList.map((license) => ({
              id: license.id || Date.now() + Math.random(),
              tally_serial_number: license.tally_serial_number || "",
              license_type: getMasterId(license.license_type),
              admin_id: license.admin_id || "",
              expiry_date: license.expiry_date || "",
              _isExisting: true,
            }))
          : [
              {
                id: Date.now(),
                tally_serial_number: "",
                license_type: "",
                admin_id: "",
                expiry_date: "",
              },
            ],
      );
    } catch (error) {
      console.error("Error loading customer data:", error);
      setErrorMessage("Failed to load customer data");
    } finally {
      setLoadingData(false);
    }
  };

  // Toggle section
  const toggleSection = (section) => {
    setSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Handle customer data change
  const handleCustomerChange = (e) => {
    const { name, value } = e.target;
    setCustomerData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    setErrorMessage("");
  };

  // Contact Handlers
  const handleContactChange = (id, field, value) => {
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === id ? { ...contact, [field]: value } : contact,
      ),
    );
    setErrorMessage("");
  };

  const addContact = () => {
    setContacts((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), contact_name: "", contact_number: "" },
    ]);
  };

  const removeContact = (id) => {
    if (contacts.length <= 1) {
      alert("At least one contact is required");
      return;
    }
    setContacts((prev) => prev.filter((contact) => contact.id !== id));
  };

  // License Handlers
  const handleLicenseChange = (id, field, value) => {
    if (field === "tally_serial_number") {
      value = normalizeTallySerialNumber(value);
    }
    setLicenses((prev) =>
      prev.map((license) =>
        license.id === id ? { ...license, [field]: value } : license,
      ),
    );
    const licenseIndex = licenses.findIndex((license) => license.id === id);
    const errorField =
      field === "tally_serial_number" ? "tally_serial" : field;
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`${errorField}_${licenseIndex}`];
      if (field === "tally_serial_number" && !value) {
        delete next[`license_type_${licenseIndex}`];
        delete next[`admin_id_${licenseIndex}`];
        delete next[`expiry_date_${licenseIndex}`];
      }
      return next;
    });
    setErrorMessage("");
  };

  const addLicense = () => {
    setLicenses((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        tally_serial_number: "",
        license_type: "",
        admin_id: "",
        expiry_date: "",
      },
    ]);
  };

  const removeLicense = (id) => {
    if (licenses.length <= 1) {
      alert("At least one license is required");
      return;
    }
    setLicenses((prev) => prev.filter((license) => license.id !== id));
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toISOString().split("T")[0];
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};
    if (!customerData.customer_code) {
      newErrors.customer_code = "Customer code is required";
    }
    Object.assign(newErrors, getRequiredCustomerErrors(customerData));
    if (customerData.email_id && !/\S+@\S+\.\S+/.test(customerData.email_id)) {
      newErrors.email_id = "Invalid email format";
    }

    contacts.forEach((contact, index) => {
      if (!contact.contact_name) {
        newErrors[`contact_name_${index}`] = "Contact name is required";
      }
      const contactNumberError = getContactNumberError(contact.contact_number);
      if (contactNumberError) {
        newErrors[`contact_number_${index}`] = contactNumberError;
      }
    });

    licenses.forEach((license, index) => {
      for (const [field, message] of Object.entries(getLicenseErrors(license))) {
        newErrors[`${field}_${index}`] = message;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit form - Update
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    const token = localStorage.getItem("access_token");
    if (!token) {
      setErrorMessage("Please login to continue");
      setTimeout(() => (window.location.href = "/crm/login"), 2000);
      return;
    }

    if (!validateForm()) {
      alert("Please fix all errors before submitting");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        ...customerData,
        contacts: contacts.map(({ id, _isExisting, ...rest }) => rest),
        licenses: prepareLicensesForPayload(licenses.map(({ _isExisting, ...rest }) => rest)),
      };

      await api.put(`customers/${customerId}/`, payload);
      setSuccessMessage("✅ Customer updated successfully!");
      handleUpdated();
    } catch (error) {
      console.error("Error updating customer:", error);
      if (error.response?.status === 401) {
        setErrorMessage("Session expired. Please login again.");
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        setTimeout(() => (window.location.href = "/crm/login"), 2000);
      } else if (error.response?.data) {
        const errorData = error.response.data;
        if (typeof errorData === "object") {
          const errorMessages = Object.values(errorData).flat().join("\n");
          setErrorMessage(`Error: ${errorMessages}`);
        } else {
          setErrorMessage(`Error: ${errorData}`);
        }
      } else {
        setErrorMessage("Failed to update customer. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loadingData) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="loading-shimmer">
            <div className="spinner"></div>
            <p>Loading customer data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content modal-large"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="modal-header">
          <div className="header-info">
            <button type="button" className="back-btn" onClick={onClose}>
              ← Back
            </button>
            <div className="customer-header-text">
              <h2>
                <span className="edit-icon">✏️</span> Edit Customer
              </h2>
              <p className="customer-title">
                {customerData.customer_name}
                {customerData.company_name && ` - ${customerData.company_name}`}
              </p>
            </div>
          </div>
          <div className="header-badge">
            <span className="badge">#{customerData.customer_code}</span>
          </div>
        </div>

        {/* Messages */}
        {successMessage && (
          <div className="success-message show">{successMessage}</div>
        )}
        {errorMessage && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-body">
          {/* CUSTOMER INFORMATION */}
          <div className="customer-card">
            <div className="section-header">
              <h3>
                <span className="section-icon">📋</span> Customer Information
              </h3>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Customer Code</label>
                <input
                  type="text"
                  name="customer_code"
                  value={customerData.customer_code}
                  onChange={handleCustomerChange}
                  className="customer-input input-readonly"
                  readOnly
                />
              </div>

              <div className="form-group">
                <label>Customer Name</label>
                <input
                  type="text"
                  name="customer_name"
                  value={customerData.customer_name}
                  onChange={handleCustomerChange}
                  placeholder="Enter customer name"
                  className={`customer-input ${
                    errors.customer_name ? "error" : ""
                  }`}
                />
                {errors.customer_name && (
                  <span className="error-text">{errors.customer_name}</span>
                )}
              </div>

              <div className="form-group">
                <label>Company Name *</label>
                <input
                  type="text"
                  name="company_name"
                  value={customerData.company_name}
                  onChange={handleCustomerChange}
                  placeholder="Enter company name"
                  className={`customer-input ${errors.company_name ? "error" : ""}`}
                />
              {errors.company_name && (
                  <span className="error-text">{errors.company_name}</span>
                )}
              </div>

              <div className="form-group">
                <label>Email ID</label>
                <input
                  type="email"
                  name="email_id"
                  value={customerData.email_id}
                  onChange={handleCustomerChange}
                  placeholder="Enter email address"
                  className={`customer-input ${errors.email_id ? "error" : ""}`}
                />
                {errors.email_id && (
                  <span className="error-text">{errors.email_id}</span>
                )}
              </div>

              <div className="form-group">
                <label>Customer Type *</label>
                <select
                  name="customer_type"
                  value={customerData.customer_type}
                  onChange={handleCustomerChange}
                  className={`customer-select ${errors.customer_type ? "error" : ""}`}
                >
                  <option value="">Select Customer Type</option>
                  {customerTypes.map((type) => (
                    <option key={type.Id} value={type.Id}>
                      {type.customer_type_name}
                    </option>
                  ))}
                </select>
              {errors.customer_type && (
                  <span className="error-text">{errors.customer_type}</span>
                )}
              </div>

              <div className="form-group">
                <label>Customer Rating</label>
                <select
                  name="customer_rating"
                  value={customerData.customer_rating}
                  onChange={handleCustomerChange}
                  className="customer-select"
                >
                  <option value="">Select Rating</option>
                  {ratingTypes.map((rating) => (
                    <option key={rating.Id} value={rating.Id}>
                      {rating.rating_type_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group full-width">
                <label>Address</label>
                <textarea
                  name="address"
                  value={customerData.address}
                  onChange={handleCustomerChange}
                  placeholder="Enter complete address"
                  className="customer-textarea"
                  rows="2"
                />
              </div>

              <div className="form-group">
                <label>Pincode</label>
                <input
                  type="text"
                  name="pincode"
                  value={customerData.pincode}
                  onChange={handleCustomerChange}
                  placeholder="Enter pincode"
                  className="customer-input"
                />
              </div>

              <div className="form-group">
                <label>City</label>
                <input
                  type="text"
                  name="city"
                  value={customerData.city}
                  onChange={handleCustomerChange}
                  placeholder="Enter city"
                  className="customer-input"
                />
              </div>

              <div className="form-group">
                <label>State</label>
                <input
                  type="text"
                  name="state"
                  value={customerData.state}
                  onChange={handleCustomerChange}
                  placeholder="Enter state"
                  className="customer-input"
                />
              </div>

              <div className="form-group">
                <label>Country</label>
                <input
                  type="text"
                  name="country"
                  value={customerData.country}
                  onChange={handleCustomerChange}
                  placeholder="Enter country"
                  className="customer-input"
                />
              </div>

              <div className="form-group">
                <label>GST Number *</label>
                <input
                  type="text"
                  name="gst_number"
                  value={customerData.gst_number}
                  onChange={handleCustomerChange}
                  placeholder="Enter GST number"
                  className={`customer-input ${errors.gst_number ? "error" : ""}`}
                />
              {errors.gst_number && (
                  <span className="error-text">{errors.gst_number}</span>
                )}
              </div>

              <div className="form-group full-width">
                <label>Notes</label>
                <textarea
                  name="notes"
                  value={customerData.notes}
                  onChange={handleCustomerChange}
                  placeholder="Additional notes"
                  className="customer-textarea"
                  rows="1"
                />
              </div>
            </div>
          </div>

          {/* CONTACT DETAILS */}
          <div className="customer-card">
            <div
              className="section-header collapsible-header"
              onClick={() => toggleSection("contacts")}
            >
              <div className="section-header-left">
                <h3>
                  <span className="section-icon">👤</span> Contact Details
                </h3>
                <span className="section-count">{contacts.length}</span>
              </div>
              <div className="section-header-right">
                <button
                  type="button"
                  className="add-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    addContact();
                  }}
                >
                  + Add Contact
                </button>
                <span className="toggle-icon">
                  {sections.contacts ? "▲" : "▼"}
                </span>
              </div>
            </div>

            {sections.contacts && (
              <div className="section-content">
                {contacts.map((contact, index) => (
                  <div key={contact.id} className="contact-item">
                    <div className="item-header">
                      <span className="item-number">#{index + 1}</span>
                      <button
                        type="button"
                        className="remove-btn"
                        onClick={() => removeContact(contact.id)}
                      >
                        ×
                      </button>
                    </div>
                    <div className="contact-row">
                      <div className="form-group">
                        <label>Contact Person Name *</label>
                        <input
                          type="text"
                          value={contact.contact_name}
                          onChange={(e) =>
                            handleContactChange(
                              contact.id,
                              "contact_name",
                              e.target.value,
                            )
                          }
                          placeholder="Enter contact name"
                          className={`customer-input ${
                            errors[`contact_name_${index}`] ? "error" : ""
                          }`}
                        />
                        {errors[`contact_name_${index}`] && (
                          <span className="error-text">
                            {errors[`contact_name_${index}`]}
                          </span>
                        )}
                      </div>
                      <div className="form-group">
                        <label>Contact Number *</label>
                        <input
                          type="text"
                          value={contact.contact_number}
                          onChange={(e) =>
                            handleContactChange(
                              contact.id,
                              "contact_number",
                              e.target.value,
                            )
                          }
                          placeholder="Enter contact number"
                          className={`customer-input ${
                            errors[`contact_number_${index}`] ? "error" : ""
                          }`}
                        />
                        {errors[`contact_number_${index}`] && (
                          <span className="error-text">
                            {errors[`contact_number_${index}`]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* LICENSE DETAILS */}
          <div className="customer-card">
            <div
              className="section-header collapsible-header"
              onClick={() => toggleSection("licenses")}
            >
              <div className="section-header-left">
                <h3>
                  <span className="section-icon">🔑</span> License Details
                </h3>
                <span className="section-count">{licenses.length}</span>
              </div>
              <div className="section-header-right">
                <button
                  type="button"
                  className="add-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    addLicense();
                  }}
                >
                  + Add License
                </button>
                <span className="toggle-icon">
                  {sections.licenses ? "▲" : "▼"}
                </span>
              </div>
            </div>

            {sections.licenses && (
              <div className="section-content">
                {licenses.map((license, index) => (
                  <div key={license.id} className="license-item">
                    <div className="item-header">
                      <span className="item-number">#{index + 1}</span>
                      <button
                        type="button"
                        className="remove-btn"
                        onClick={() => removeLicense(license.id)}
                      >
                        ×
                      </button>
                    </div>
                    <div className="license-row">
                      <div className="form-group">
                        <label>Tally Serial Number</label>
                        <input
                          type="text"
                          value={license.tally_serial_number}
                          inputMode="numeric"
                          maxLength={9}
                          pattern="[0-9]{9}"
                          onChange={(e) =>
                            handleLicenseChange(
                              license.id,
                              "tally_serial_number",
                              e.target.value,
                            )
                          }
                          placeholder="Enter serial number"
                          className={`customer-input ${
                            errors[`tally_serial_${index}`] ? "error" : ""
                          }`}
                        />
                        {errors[`tally_serial_${index}`] && (
                          <span className="error-text">
                            {errors[`tally_serial_${index}`]}
                          </span>
                        )}
                      </div>

                      <div className="form-group">
                        <label>License Type {license.tally_serial_number && "*"}</label>
                        <select
                          value={license.license_type}
                          onChange={(e) =>
                            handleLicenseChange(
                              license.id,
                              "license_type",
                              e.target.value,
                            )
                          }
                          className={`customer-select ${errors[`license_type_${index}`] ? "error" : ""}`}
                        >
                          <option value="">Select License Type</option>
                          {licenseTypes.map((type) => (
                            <option key={type.Id} value={type.Id}>
                              {type.license_type_name}
                            </option>
                          ))}
                        </select>
                      {errors[`license_type_${index}`] && (
                          <span className="error-text">{errors[`license_type_${index}`]}</span>
                        )}
                      </div>

                      <div className="form-group">
                        <label>Admin ID {license.tally_serial_number && "*"}</label>
                        <input
                          type="text"
                          value={license.admin_id}
                          onChange={(e) =>
                            handleLicenseChange(
                              license.id,
                              "admin_id",
                              e.target.value,
                            )
                          }
                          placeholder="Enter admin ID"
                          className={`customer-input ${errors[`admin_id_${index}`] ? "error" : ""}`}
                        />
                      {errors[`admin_id_${index}`] && (
                          <span className="error-text">{errors[`admin_id_${index}`]}</span>
                        )}
                      </div>

                      <div className="form-group">
                        <label>Expiry Date {license.tally_serial_number && "*"}</label>
                        <input
                          type="date"
                          value={formatDate(license.expiry_date)}
                          onChange={(e) =>
                            handleLicenseChange(
                              license.id,
                              "expiry_date",
                              e.target.value,
                            )
                          }
                          className={`customer-input ${
                            errors[`expiry_date_${index}`] ? "error" : ""
                          }`}
                        />
                        {errors[`expiry_date_${index}`] && (
                          <span className="error-text">
                            {errors[`expiry_date_${index}`]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* FORM ACTIONS */}
          <div className="form-actions">
            <button type="submit" className="save-btn" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Updating...
                </>
              ) : (
                "💾 Update Customer"
              )}
            </button>
            <button type="button" className="reset-btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
