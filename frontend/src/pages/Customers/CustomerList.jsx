import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { FiEye, FiEdit3, FiTrash2 } from "react-icons/fi";
import "./CustomerList.css";
import ViewCustomer from "./ViewCustomer";
import EditCustomer from "./EditCustomer";
import {
  formatCustomerImportError,
  formatCustomerImportResult,
} from "./customerTransfer";

const API_BASE = "http://127.0.0.1:8000/api";

const TransferIcon = ({ type }) => {
  const paths = {
    template: <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" />,
    import: <path d="M12 21V9m0 0 4 4m-4-4-4 4M5 5h14" />,
    export: <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19h14" />,
  };
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      {paths[type]}
    </svg>
  );
};

function CustomerList({ permissions = {} }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [transferState, setTransferState] = useState({ type: "", message: "" });
  const [transferLoading, setTransferLoading] = useState("");
  const importInputRef = useRef(null);
  const itemsPerPage = 5;

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    try {
      const token = localStorage.getItem("access_token");
      console.log("TOKEN =", token);

      const response = await axios.get("http://127.0.0.1:8000/api/customers/", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("API Response:", response.data);
      setCustomers(response.data);
    } catch (error) {
      console.error("Error fetching customers:", error);

      if (error.response?.status === 401) {
        alert("Login expired. Please login again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Delete
  const handleDelete = async (customerId, customerName) => {
    if (!window.confirm(`Are you sure you want to delete "${customerName}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem("access_token");
      await axios.delete(`http://127.0.0.1:8000/api/customers/${customerId}/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      alert("Customer deleted successfully!");
      fetchCustomers();
    } catch (error) {
      console.error("Error deleting customer:", error);
      alert("Failed to delete customer. Please try again.");
    }
  };

  // Handle View - Opens modal
  const handleView = (customerId) => {
    setSelectedCustomerId(customerId);
    setShowViewModal(true);
  };

  // Handle Edit - Opens modal
  const handleEdit = (customerId) => {
    setSelectedCustomerId(customerId);
    setShowEditModal(true);
  };

  // Close modals
  const closeViewModal = () => {
    setShowViewModal(false);
    setSelectedCustomerId(null);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedCustomerId(null);
  };

  // Refresh list after update
  const handleUpdate = () => {
    fetchCustomers();
  };

  // Get customer initials for avatar
  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Filter customers based on search
  const filteredCustomers = customers.filter((customer) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      customer.customer_code?.toLowerCase().includes(searchLower) ||
      customer.customer_name?.toLowerCase().includes(searchLower) ||
      customer.company_name?.toLowerCase().includes(searchLower) ||
      customer.email_id?.toLowerCase().includes(searchLower) ||
      customer.contact_number?.toLowerCase().includes(searchLower) ||
      customer.address?.toLowerCase().includes(searchLower) ||
      customer.gst_number?.toLowerCase().includes(searchLower)
    );
  });

  // Pagination
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCustomers = filteredCustomers.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleExport = async () => {
    try {
      setTransferLoading("export");
      setTransferState({ type: "", message: "" });
      const token = getToken();

      const response = await axios.get(
        `${API_BASE}/customers/export/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: "blob",
        },
      );

      downloadBlob(response.data, "Customers.xlsx");
      setTransferState({ type: "success", message: "Customer export downloaded." });
    } catch (error) {
      console.error(error);
      setTransferState({ type: "error", message: "Customer export failed." });
    } finally {
      setTransferLoading("");
    }
  }

  const handleTemplateDownload = async () => {
    try {
      setTransferLoading("template");
      setTransferState({ type: "", message: "" });
      const response = await axios.get(`${API_BASE}/customers/import_template/`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        responseType: "blob",
      });
      downloadBlob(response.data, "Customer_Import_Template.xlsx");
      setTransferState({ type: "success", message: "Import template downloaded." });
    } catch (error) {
      console.error(error);
      setTransferState({ type: "error", message: "Template download failed." });
    } finally {
      setTransferLoading("");
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];

    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      setTransferLoading("import");
      setTransferState({ type: "", message: "" });
      const token = getToken();

      await axios.post(
        `${API_BASE}/customers/import_excel/`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      ).then((response) => {
        setTransferState({
          type: "success",
          message: formatCustomerImportResult(response.data),
        });
      });

      fetchCustomers();
    } catch (error) {
      console.error(error);
      setTransferState({ type: "error", message: formatCustomerImportError(error) });
    } finally {
      setTransferLoading("");
      e.target.value = "";
    }
  };

  const getToken = () =>
    localStorage.getItem("crm_access_token") ||
    localStorage.getItem("access_token") ||
    "";

  const downloadBlob = (data, filename) => {
    const url = window.URL.createObjectURL(new Blob([data]));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  if (showEditModal && selectedCustomerId) {
    return (
      <EditCustomer
        customerId={selectedCustomerId}
        onClose={closeEditModal}
        onUpdate={handleUpdate}
      />
    );
  }

  return (
    <div className="customer-container">
      <div className="customer-header">
        <h2>Customer Master</h2>
        <div className="header-actions">
          <div className="search-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={handleSearch}
              aria-label="Search customers"
            />
          </div>
          <div className="transfer-actions" aria-label="Customer Excel actions">
            <button
              type="button"
              className="transfer-btn template-btn"
              onClick={handleTemplateDownload}
              disabled={Boolean(transferLoading)}
            >
              <TransferIcon type="template" />
              {transferLoading === "template" ? "Downloading..." : "Template"}
            </button>

            {permissions.add && (
              <button
                type="button"
                className="transfer-btn import-btn"
                onClick={() => importInputRef.current?.click()}
                disabled={Boolean(transferLoading)}
              >
                <TransferIcon type="import" />
                {transferLoading === "import" ? "Importing..." : "Import"}
              </button>
            )}

            <button
              type="button"
              className="transfer-btn export-btn"
              onClick={handleExport}
              disabled={Boolean(transferLoading)}
            >
              <TransferIcon type="export" />
              {transferLoading === "export" ? "Exporting..." : "Export"}
            </button>
          </div>

          <input
            ref={importInputRef}
            type="file"
            id="importFile"
            accept=".xlsx,.xls"
            style={{ display: "none" }}
            onChange={handleImport}
          />

          {permissions.add && <button className="add-btn">Add Customer</button>}
        </div>
      </div>

      {transferState.message && (
        <div className={`transfer-notice ${transferState.type}`} role="status">
          {transferState.message}
        </div>
      )}

      <div className="customer-card">
        <div className="table-responsive">
          <table className="customer-table">
            <colgroup>
              <col className="code-column" />
              <col className="name-column" />
              <col className="company-column" />
              <col className="contact-column" />
              <col className="email-column" />
              <col className="address-column" />
              <col className="gst-column" />
              <col className="actions-column" />
            </colgroup>
            <thead>
              <tr>
                <th>Code</th>
                <th>Customer Name</th>
                <th>Company</th>
                <th>Contact Number</th>
                <th>Email</th>
                <th>Address</th>
                <th>GST Number</th>
                <th className="action-column">Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8">
                    <div className="loading-shimmer">
                      <div className="spinner"></div>
                      <p>Loading customers...</p>
                    </div>
                  </td>
                </tr>
              ) : currentCustomers.length > 0 ? (
                currentCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <span className="customer-code">
                        {customer.customer_code || "N/A"}
                      </span>
                    </td>
                    <td>
                      <span className="customer-name">
                        <span className="avatar">
                          {getInitials(customer.customer_name)}
                        </span>
                        {customer.customer_name || "-"}
                      </span>
                    </td>
                    <td>{customer.company_name || "-"}</td>
                    <td>{customer.contact_number || "-"}</td>
                    <td>{customer.email_id || "-"}</td>
                    <td className="address-cell">{customer.address || "-"}</td>
                    <td>{customer.gst_number || "-"}</td>
                    <td className="action-column">
                      <div className="action-buttons">
                        {permissions.view && (
                          <button
                            type="button"
                            className="action-btn view-btn"
                            onClick={() => handleView(customer.id)}
                            aria-label="View customer"
                          >
                            <FiEye size={15} />
                          </button>
                        )}
                        {permissions.edit && (
                          <button
                            type="button"
                            className="action-btn edit-btn"
                            onClick={() => handleEdit(customer.id)}
                            aria-label="Edit customer"
                          >
                            <FiEdit3 size={15} />
                          </button>
                        )}
                        {permissions.delete && (
                          <button
                            type="button"
                            className="action-btn delete-btn"
                            onClick={() =>
                              handleDelete(customer.id, customer.customer_name)
                            }
                            aria-label="Delete customer"
                          >
                            <FiTrash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8">
                    <div className="empty-state">
                      <span className="empty-icon">📭</span>
                      <p>No Customers Found</p>
                      <div className="sub-text">
                        {searchTerm
                          ? `No results for "${searchTerm}"`
                          : "Start by adding your first customer"}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!loading && filteredCustomers.length > 0 && (
          <div className="table-footer">
            <div className="stats">
              <span>👥 {filteredCustomers.length} customers</span>
              <span>
                👁️ Showing {startIndex + 1}-
                {Math.min(endIndex, filteredCustomers.length)}
              </span>
            </div>
            <div className="pagination">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                ←
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    className={currentPage === page ? "active" : ""}
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </button>
                ),
              )}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* View Customer Modal */}
      {showViewModal && (
        <ViewCustomer
          customerId={selectedCustomerId}
          onClose={closeViewModal}
        />
      )}

    </div>
  );
}

export default CustomerList;
