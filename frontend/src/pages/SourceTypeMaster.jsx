// SourceTypeMaster.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import "../styles/Master.css";

export default function SourceTypeMaster({ permissions = {} }) {
  const [sourceType, setSourceType] = useState("");
  const [sourceTypes, setSourceTypes] = useState([]);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const canSave = editId ? permissions.edit : permissions.add;

  // Load Source Type Grid Data
  const loadSourceTypes = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        "/crm/api/source-types/",
      );
      setSourceTypes(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSourceTypes();
  }, []);

  // Save / Update source type
  const handleSave = async () => {
    try {
      if (sourceType.trim() === "") {
        alert("Please enter a source type name");
        return;
      }

      setLoading(true);

      if (editId) {
        await axios.put(`/crm/api/source-types/${editId}/`, {
          source_type_name: sourceType,
        });
        alert("Source type updated successfully");
      } else {
        await axios.post("/crm/api/source-types/", {
          source_type_name: sourceType,
        });
        alert("Source type saved successfully");
      }

      setSourceType("");
      setEditId(null);
      await loadSourceTypes();
    } catch (error) {
      console.error(error);
      alert("Error while saving source type");
    } finally {
      setLoading(false);
    }
  };

  // Edit source type
  const handleEdit = (item) => {
    setEditId(item.Id);
    setSourceType(item.source_type_name);
  };

  // Delete source type
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this source type?"))
      return;

    try {
      setLoading(true);
      await axios.delete(`/crm/api/source-types/${id}/`);
      alert("Source type deleted successfully");
      await loadSourceTypes();
    } catch (error) {
      console.error(error);
      alert("Failed to delete source type");
    } finally {
      setLoading(false);
    }
  };

  // Clear form
  const handleClear = () => {
    setSourceType("");
    setEditId(null);
  };

  // Filter source types based on search
  const filteredSourceTypes = sourceTypes.filter((item) =>
    item.source_type_name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="master-container">
      {/* Header */}
      <div className="master-header">
        <div className="header-content">
          <div>
            <h2>Source Type Master</h2>
            <p>Manage all source types used in CRM</p>
          </div>
          <div className="header-stats">
            <span className="stat-badge">Total: {sourceTypes.length}</span>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="master-card">
        <div className="form-row">
          <div className="form-group">
            <label>Source Type Name</label>
            <div className="input-wrapper">
              <input
                type="text"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                placeholder="Enter source type name"
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
            <h3>Source Type List</h3>
          </div>
          <div className="table-header-right">
            <div className="search-wrapper">
              <input
                type="text"
                placeholder="Search source types..."
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
                <th>Source Type Name</th>
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
              ) : filteredSourceTypes.length > 0 ? (
                filteredSourceTypes.map((item, index) => (
                  <tr
                    key={item.Id}
                    className={editId === item.Id ? "editing-row" : ""}
                  >
                    <td className="col-sno">{index + 1}</td>
                    <td className="product-name">{item.source_type_name}</td>
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
                      ? "No matching source types found"
                      : "No source types added yet"}
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
