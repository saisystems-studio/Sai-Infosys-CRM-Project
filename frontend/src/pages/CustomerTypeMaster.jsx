// CustomerTypeMaster.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import "../styles/Master.css";

export default function CustomerTypeMaster({ permissions = {} }) {
  const [customerType, setCustomerType] = useState("");
  const [customerTypes, setCustomerTypes] = useState([]);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const canSave = editId ? permissions.edit : permissions.add;

  // Load Customer Type Grid Data
  const loadCustomerTypes = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        "http://127.0.0.1:8000/api/customer-types/",
      );
      setCustomerTypes(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomerTypes();
  }, []);

  // Save / Update customer type
  const handleSave = async () => {
    try {
      if (customerType.trim() === "") {
        alert("Please enter a customer type name");
        return;
      }

      setLoading(true);

      if (editId) {
        await axios.put(`http://127.0.0.1:8000/api/customer-types/${editId}/`, {
          customer_type_name: customerType,
        });
        alert("Customer type updated successfully");
      } else {
        await axios.post("http://127.0.0.1:8000/api/customer-types/", {
          customer_type_name: customerType,
        });
        alert("Customer type saved successfully");
      }

      setCustomerType("");
      setEditId(null);
      await loadCustomerTypes();
    } catch (error) {
      console.error(error);
      alert("Error while saving customer type");
    } finally {
      setLoading(false);
    }
  };

  // Edit customer type
  const handleEdit = (item) => {
    setEditId(item.Id);
    setCustomerType(item.customer_type_name);
  };

  // Delete customer type
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this customer type?"))
      return;

    try {
      setLoading(true);
      await axios.delete(`http://127.0.0.1:8000/api/customer-types/${id}/`);
      alert("Customer type deleted successfully");
      await loadCustomerTypes();
    } catch (error) {
      console.error(error);
      alert("Failed to delete customer type");
    } finally {
      setLoading(false);
    }
  };

  // Clear form
  const handleClear = () => {
    setCustomerType("");
    setEditId(null);
  };

  // Filter customer types based on search
  const filteredCustomerTypes = customerTypes.filter((item) =>
    item.customer_type_name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="master-container">
      {/* Header */}
      <div className="master-header">
        <div className="header-content">
          <div>
            <h2>Customer Type Master</h2>
            <p>Manage all customer types used in CRM</p>
          </div>
          <div className="header-stats">
            <span className="stat-badge">Total: {customerTypes.length}</span>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="master-card">
        <div className="form-row">
          <div className="form-group">
            <label>Customer Type Name</label>
            <div className="input-wrapper">
              <input
                type="text"
                value={customerType}
                onChange={(e) => setCustomerType(e.target.value)}
                placeholder="Enter customer type name"
                className="master-input"
                onKeyPress={(e) => e.key === "Enter" && handleSave()}
              />
              {editId && <span className="edit-indicator">Editing</span>}
            </div>
          </div>
          <div className="button-group">
            <button
              className="save-btn"
              onClick={handleSave}
              disabled={loading}
              hidden={!canSave}
            >
              {loading ? (
                <>
                  <span className="spinner"></span> Processing...
                </>
              ) : editId ? (
                "Update"
              ) : (
                "Save"
              )}
            </button>
            {editId && (
              <button className="cancel-btn" onClick={handleClear}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="table-card">
        <div className="table-header">
          <div className="table-header-left">
            <h3>Customer Type List</h3>
          </div>
          <div className="table-header-right">
            <div className="search-wrapper">
              <input
                type="text"
                placeholder="Search customer types..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <span className="search-icon">🔍</span>
            </div>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="master-table">
            <thead>
              <tr>
                <th className="col-sno">#</th>
                <th>Customer Type Name</th>
                <th className="col-status">Status</th>
                <th className="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" className="loading-cell">
                    <div className="loader"></div>
                    Loading...
                  </td>
                </tr>
              ) : filteredCustomerTypes.length > 0 ? (
                filteredCustomerTypes.map((item, index) => (
                  <tr
                    key={item.Id}
                    className={editId === item.Id ? "editing-row" : ""}
                  >
                    <td className="col-sno">{index + 1}</td>
                    <td className="product-name">{item.customer_type_name}</td>
                    <td className="col-status">
                      <span className="status-badge active">Active</span>
                    </td>
                    <td className="col-actions">
                      <div className="action-group">
                        <button
                          hidden={!permissions.edit}
                          className="action-btn edit-btn"
                          onClick={() => handleEdit(item)}
                          title="Edit"
                        >
                          <svg
                            className="action-icon"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          hidden={!permissions.delete}
                          className="action-btn delete-btn"
                          onClick={() => handleDelete(item.Id)}
                          title="Delete"
                        >
                          <svg
                            className="action-icon"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 6h18" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="empty-cell">
                    {searchTerm
                      ? "No matching customer types found"
                      : "No customer types added yet"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
