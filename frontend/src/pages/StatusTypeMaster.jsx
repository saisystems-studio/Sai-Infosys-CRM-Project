// StatusTypeMaster.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import "../styles/Master.css";

export default function StatusTypeMaster({ permissions = {} }) {
  const [statusType, setStatusType] = useState("");
  const [statusTypes, setStatusTypes] = useState([]);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const canSave = editId ? permissions.edit : permissions.add;

  // Load Status Type Grid Data
  const loadStatusTypes = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        "/crm/api/status-types/",
      );
      setStatusTypes(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatusTypes();
  }, []);

  // Save / Update status type
  const handleSave = async () => {
    try {
      if (statusType.trim() === "") {
        alert("Please enter a status type name");
        return;
      }

      setLoading(true);

      if (editId) {
        await axios.put(`/crm/api/status-types/${editId}/`, {
          status_type_name: statusType,
        });
        alert("Status type updated successfully");
      } else {
        await axios.post("/crm/api/status-types/", {
          status_type_name: statusType,
        });
        alert("Status type saved successfully");
      }

      setStatusType("");
      setEditId(null);
      await loadStatusTypes();
    } catch (error) {
      console.error(error);
      alert("Error while saving status type");
    } finally {
      setLoading(false);
    }
  };

  // Edit status type
  const handleEdit = (item) => {
    setEditId(item.Id);
    setStatusType(item.status_type_name);
  };

  // Delete status type
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this status type?"))
      return;

    try {
      setLoading(true);
      await axios.delete(`/crm/api/status-types/${id}/`);
      alert("Status type deleted successfully");
      await loadStatusTypes();
    } catch (error) {
      console.error(error);
      alert("Failed to delete status type");
    } finally {
      setLoading(false);
    }
  };

  // Clear form
  const handleClear = () => {
    setStatusType("");
    setEditId(null);
  };

  // Filter status types based on search
  const filteredStatusTypes = statusTypes.filter((item) =>
    item.status_type_name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="master-container">
      {/* Header */}
      <div className="master-header">
        <div className="header-content">
          <div>
            <h2>Status Type Master</h2>
            <p>Manage all status types used in CRM</p>
          </div>
          <div className="header-stats">
            <span className="stat-badge">Total: {statusTypes.length}</span>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="master-card">
        <div className="form-row">
          <div className="form-group">
            <label>Status Type Name</label>
            <div className="input-wrapper">
              <input
                type="text"
                value={statusType}
                onChange={(e) => setStatusType(e.target.value)}
                placeholder="Enter status type name"
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
            <h3>Status Type List</h3>
          </div>
          <div className="table-header-right">
            <div className="search-wrapper">
              <input
                type="text"
                placeholder="Search status types..."
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
                <th>Status Type Name</th>
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
              ) : filteredStatusTypes.length > 0 ? (
                filteredStatusTypes.map((item, index) => (
                  <tr
                    key={item.Id}
                    className={editId === item.Id ? "editing-row" : ""}
                  >
                    <td className="col-sno">{index + 1}</td>
                    <td className="product-name">{item.status_type_name}</td>
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
                      ? "No matching status types found"
                      : "No status types added yet"}
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
