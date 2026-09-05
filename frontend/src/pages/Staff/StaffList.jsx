import { useEffect, useState } from "react";
import axios from "axios";
import "./StaffList.css";

const API_URL = import.meta.env.VITE_API_URL || "/crm/api";

function StaffList({ onAddStaff, onEditStaff, permissions = {} }) {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [imageErrors, setImageErrors] = useState({});

  /* =========================================================
     LOAD STAFF
  ========================================================= */

  const loadStaff = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("crm_access_token");

      const response = await axios.get(`${API_URL}/staff/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("Staff data received:", response.data);
      setStaffList(response.data);
    } catch (error) {
      console.error("Error loading staff:", error);

      if (error.response?.status === 401) {
        setError("Session expired. Please login again.");
      } else {
        setError("Unable to load staff details.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  /* =========================================================
     SEARCH
  ========================================================= */

  const filteredStaff = staffList.filter((staff) => {
    const searchText = search.toLowerCase();

    return (
      staff.Full_Name?.toLowerCase().includes(searchText) ||
      staff.Designation?.toLowerCase().includes(searchText) ||
      staff.Email_Address?.toLowerCase().includes(searchText) ||
      staff.Phone_Number?.toLowerCase().includes(searchText) ||
      staff.Role?.toLowerCase().includes(searchText) ||
      staff.Username_Display?.toLowerCase().includes(searchText)
    );
  });

  /* =========================================================
     IMAGE URL
  ========================================================= */

  const getImageUrl = (image) => {
    if (!image) return null;

    if (image.startsWith("http://") || image.startsWith("https://")) {
      return image;
    }

    const baseUrl = API_URL.replace("/api", "");
    const cleanPath = image.replace(/^\/+/, "");
    const fullUrl = `${baseUrl}/uploads/${cleanPath}`;

    console.log("Image path:", image, "-> Full URL:", fullUrl);

    return fullUrl;
  };

  /* =========================================================
     HANDLE IMAGE ERROR
  ========================================================= */

  const handleImageError = (staffId) => {
    setImageErrors((prev) => ({
      ...prev,
      [staffId]: true,
    }));
  };

  /* =========================================================
     INITIALS
  ========================================================= */

  const getInitials = (name) => {
    if (!name) return "ST";

    const parts = name.trim().split(" ");

    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }

    return name.substring(0, 2).toUpperCase();
  };

  /* =========================================================
     EDIT HANDLERS
  ========================================================= */

  const handleEditClick = (staff) => {
    console.log("Editing staff:", staff);

    if (onEditStaff) {
      onEditStaff(staff);
    }
  };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="staff-page">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="staff-page-header">
        <div>
          <h1>Staff</h1>

          <p>Manage your staff members, login access and menu permissions.</p>
        </div>

        {permissions.add && <button className="staff-add-button" onClick={onAddStaff}>
          <span>+</span>
          Add Staff
        </button>}
      </div>

      {/* =====================================================
          SEARCH
      ===================================================== */}

      <div className="staff-toolbar">
        <div className="staff-search">
          <span>⌕</span>

          <input
            type="text"
            placeholder="Search staff..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="staff-count">{filteredStaff.length} Staff</div>
      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && <div className="staff-error">{error}</div>}

      {/* =====================================================
          LOADING
      ===================================================== */}

      {loading ? (
        <div className="staff-loading">Loading staff...</div>
      ) : filteredStaff.length === 0 ? (
        <div className="staff-empty">
          <div className="staff-empty-icon">👤</div>

          <h3>No staff found</h3>

          <p>
            {search
              ? "No staff matches your search."
              : "Start by adding your first staff member."}
          </p>

          {!search && permissions.add && (
            <button className="staff-add-button" onClick={onAddStaff}>
              + Add Staff
            </button>
          )}
        </div>
      ) : (
        /* ===================================================
           TABLE
        =================================================== */

        <div className="staff-table-card">
          <div className="staff-table-wrapper">
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Designation</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Hire Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredStaff.map((staff) => {
                  const imageUrl = getImageUrl(staff.Staff_Image);
                  const hasImageError = imageErrors[staff.Id];

                  return (
                    <tr key={staff.Id}>
                      {/* STAFF */}

                      <td>
                        <div className="staff-info">
                          {imageUrl && !hasImageError ? (
                            <img
                              src={imageUrl}
                              alt={staff.Full_Name}
                              className="staff-avatar"
                              onError={() => handleImageError(staff.Id)}
                            />
                          ) : (
                            <div className="staff-avatar staff-avatar-placeholder">
                              {getInitials(staff.Full_Name)}
                            </div>
                          )}

                          <div>
                            <strong>{staff.Full_Name}</strong>

                            <small>@{staff.Username_Display || "-"}</small>
                          </div>
                        </div>
                      </td>

                      {/* DESIGNATION */}

                      <td>{staff.Designation || "-"}</td>

                      {/* EMAIL */}

                      <td>{staff.Email_Address || "-"}</td>

                      {/* PHONE */}

                      <td>{staff.Phone_Number || "-"}</td>

                      {/* ROLE */}

                      <td>
                        <span className="role-badge">
                          {staff.Role || "User"}
                        </span>
                      </td>

                      {/* HIRE DATE */}

                      <td>{staff.Hire_Date || "-"}</td>

                      {/* STATUS */}

                      <td>
                        {staff.Is_Active ? (
                          <span className="status-badge active">Active</span>
                        ) : (
                          <span className="status-badge inactive">
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* ACTION */}

                      <td>
                        {permissions.edit && <button
                          className="staff-edit-button"
                          onClick={() => handleEditClick(staff)}
                        >
                          Edit
                        </button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================
          EDIT MODAL - USING AddStaff COMPONENT
      ===================================================== */}
    </div>
  );
}

export default StaffList;
