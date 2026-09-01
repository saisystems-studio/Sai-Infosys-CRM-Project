import { useEffect, useState } from "react";
import axios from "axios";
import "./AddStaff.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";

function AddStaff({ onCancel, editData = null, isEdit = false }) {
  const [formData, setFormData] = useState({
    Full_Name: "",
    Designation: "",
    Email_Address: "",
    Phone_Number: "",
    Hire_Date: "",
    Role: "",
    Is_Active: true,
    Username: "",
    Password: "",
    Confirm_Password: "",
  });

  const [menus, setMenus] = useState([]);
  const [expandedMenus, setExpandedMenus] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [menuPermissions, setMenuPermissions] = useState({});
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const PERMISSION_TYPES = {
    VIEW: "view",
    ADD: "add",
    EDIT: "edit",
    DELETE: "delete",
  };

  // Load menus and staff data if editing
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError("");

        const token = localStorage.getItem("crm_access_token");

        const headers = {
          Authorization: `Bearer ${token}`,
        };

        // ============================================
        // LOAD MENUS
        // ============================================

        const menusResponse = await axios.get(`${API_URL}/menus/`, {
          headers,
        });

        const activeMenus = menusResponse.data
          .filter((menu) => menu.Is_Active === true)
          .sort((a, b) => a.Display_Order - b.Display_Order);

        setMenus(activeMenus);

        // ============================================
        // CREATE EMPTY PERMISSIONS
        // ============================================

        const initialPermissions = {};

        activeMenus.forEach((menu) => {
          initialPermissions[menu.Id] = {
            view: false,
            add: false,
            edit: false,
            delete: false,
          };
        });

        // ============================================
        // EDIT MODE
        // ============================================

        if (isEdit && editData?.Id) {
          console.log("Loading staff for edit:", editData.Id);

          const staffResponse = await axios.get(
            `${API_URL}/staff/${editData.Id}/`,
            {
              headers,
            },
          );

          const staffData = staffResponse.data;

          console.log("Edit staff data:", staffData);

          // ==========================================
          // SET FORM DATA
          // ==========================================

          setFormData({
            Full_Name: staffData.Full_Name || "",
            Designation: staffData.Designation || "",
            Email_Address: staffData.Email_Address || "",
            Phone_Number: staffData.Phone_Number || "",
            Hire_Date: staffData.Hire_Date
              ? String(staffData.Hire_Date).substring(0, 10)
              : "",
            Role: staffData.Role || "",
            Is_Active:
              staffData.Is_Active !== undefined ? staffData.Is_Active : true,

            // Do not load password while editing
            Username: "",
            Password: "",
            Confirm_Password: "",
          });

          // ==========================================
          // STAFF IMAGE
          // ==========================================

          if (staffData.Staff_Image) {
            const baseUrl = API_URL.replace("/api", "");
            const cleanPath = String(staffData.Staff_Image).replace(/^\/+/, "");

            setImagePreview(`${baseUrl}/uploads/${cleanPath}`);
          } else {
            setImagePreview("");
          }

          // ==========================================
          // LOAD STAFF PERMISSIONS
          // ==========================================

          const loadedPermissions = {
            ...initialPermissions,
          };

          if (staffData.Menu_Permissions_Display) {
            staffData.Menu_Permissions_Display.forEach((perm) => {
              const menuId = perm.Menu_Id ?? perm.Menu ?? perm.Menu?.Id;

              if (menuId && loadedPermissions[menuId]) {
                loadedPermissions[menuId] = {
                  view: Boolean(perm.Can_View),
                  add: Boolean(perm.Can_Add),
                  edit: Boolean(perm.Can_Edit),
                  delete: Boolean(perm.Can_Delete),
                };
              }
            });
          }

          console.log("Loaded permissions:", loadedPermissions);

          // IMPORTANT:
          // Set permissions ONLY ONCE after loading staff data
          setMenuPermissions(loadedPermissions);

          // ==========================================
          // EXPAND PARENT MENUS
          // ==========================================

          const expandedParents = activeMenus
            .filter((menu) => !menu.parent_id)
            .filter((parent) => {
              const children = activeMenus.filter(
                (child) => child.parent_id === parent.Id,
              );

              return children.some((child) => {
                const perms = loadedPermissions[child.Id];

                return (
                  perms &&
                  (perms.view || perms.add || perms.edit || perms.delete)
                );
              });
            })
            .map((menu) => menu.Id);

          setExpandedMenus(expandedParents);
        } else {
          // ==========================================
          // ADD MODE
          // ==========================================

          setMenuPermissions(initialPermissions);

          const parentIds = activeMenus
            .filter((menu) => !menu.parent_id)
            .map((menu) => menu.Id);

          setExpandedMenus(parentIds);
        }
      } catch (error) {
        console.error("Error loading staff data:", error);

        if (error.response?.data) {
          console.error("Server response:", error.response.data);
        }

        setError(
          isEdit
            ? "Unable to load staff data for editing."
            : "Unable to load menu permissions.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isEdit, editData]);

  const buildMenuTree = (menuList) => {
    const menuMap = {};
    const roots = [];

    menuList.forEach((menu) => {
      menuMap[menu.Id] = { ...menu, children: [] };
    });

    menuList.forEach((menu) => {
      if (menu.parent_id && menuMap[menu.parent_id]) {
        menuMap[menu.parent_id].children.push(menuMap[menu.Id]);
      } else if (!menu.parent_id) {
        roots.push(menuMap[menu.Id]);
      }
    });

    return roots;
  };

  const filterMenuTree = (tree, search) => {
    if (!search.trim()) return tree;

    const searchLower = search.toLowerCase();

    const filterNode = (node) => {
      const matchesName = node.Menu_Name.toLowerCase().includes(searchLower);
      const filteredChildren = node.children
        .map((child) => filterNode(child))
        .filter((child) => child !== null);

      if (matchesName || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
        };
      }
      return null;
    };

    return tree.map((node) => filterNode(node)).filter((node) => node !== null);
  };

  const toggleExpand = (menuId) => {
    setExpandedMenus((prev) =>
      prev.includes(menuId)
        ? prev.filter((id) => id !== menuId)
        : [...prev, menuId],
    );
  };

  const hasChildren = (menuId) => {
    return menus.some((m) => m.parent_id === menuId);
  };

  const getChildren = (parentId) => {
    return menus.filter((m) => m.parent_id === parentId);
  };

  const getChildrenPermissionState = (parentId, permissionType) => {
    const children = getChildren(parentId);
    if (children.length === 0) return false;
    return children.every(
      (child) =>
        menuPermissions[child.Id] && menuPermissions[child.Id][permissionType],
    );
  };

  const getAnyChildPermissionState = (parentId, permissionType) => {
    const children = getChildren(parentId);
    if (children.length === 0) return false;
    return children.some(
      (child) =>
        menuPermissions[child.Id] && menuPermissions[child.Id][permissionType],
    );
  };

  const setChildrenPermissions = (parentId, permissionType, value) => {
    const children = getChildren(parentId);
    setMenuPermissions((prev) => {
      const updated = { ...prev };
      children.forEach((child) => {
        if (permissionType === PERMISSION_TYPES.VIEW) {
          updated[child.Id] = {
            ...updated[child.Id],
            view: value,
          };
          if (!value) {
            updated[child.Id].add = false;
            updated[child.Id].edit = false;
            updated[child.Id].delete = false;
          }
        } else {
          if (value && !updated[child.Id].view) {
            updated[child.Id].view = true;
          }
          updated[child.Id][permissionType] = value;
        }
      });
      return updated;
    });
  };

  const handlePermissionChange = (menuId, permissionType, value) => {
    if (hasChildren(menuId)) {
      setChildrenPermissions(menuId, permissionType, value);
      return;
    }

    setMenuPermissions((prev) => {
      const updated = { ...prev };

      if (permissionType === PERMISSION_TYPES.VIEW) {
        updated[menuId] = {
          ...updated[menuId],
          view: value,
        };

        if (!value) {
          updated[menuId].add = false;
          updated[menuId].edit = false;
          updated[menuId].delete = false;
        }
      } else {
        if (value && !updated[menuId].view) {
          updated[menuId].view = true;
        }
        updated[menuId][permissionType] = value;
      }

      return updated;
    });
  };

  const getLeafMenus = () => {
    return menus.filter((menu) => !hasChildren(menu.Id));
  };

  const selectAllPermissions = () => {
    const newPermissions = {};
    getLeafMenus().forEach((menu) => {
      newPermissions[menu.Id] = {
        view: true,
        add: true,
        edit: true,
        delete: true,
      };
    });
    menus.forEach((menu) => {
      if (hasChildren(menu.Id) && !newPermissions[menu.Id]) {
        newPermissions[menu.Id] = {
          view: false,
          add: false,
          edit: false,
          delete: false,
        };
      }
    });
    setMenuPermissions(newPermissions);
  };

  const selectViewAll = () => {
    const newPermissions = {};
    getLeafMenus().forEach((menu) => {
      newPermissions[menu.Id] = {
        view: true,
        add: false,
        edit: false,
        delete: false,
      };
    });
    menus.forEach((menu) => {
      if (hasChildren(menu.Id) && !newPermissions[menu.Id]) {
        newPermissions[menu.Id] = {
          view: false,
          add: false,
          edit: false,
          delete: false,
        };
      }
    });
    setMenuPermissions(newPermissions);
  };

  const selectAddAll = () => {
    const newPermissions = {};
    getLeafMenus().forEach((menu) => {
      newPermissions[menu.Id] = {
        view: true,
        add: true,
        edit: false,
        delete: false,
      };
    });
    menus.forEach((menu) => {
      if (hasChildren(menu.Id) && !newPermissions[menu.Id]) {
        newPermissions[menu.Id] = {
          view: false,
          add: false,
          edit: false,
          delete: false,
        };
      }
    });
    setMenuPermissions(newPermissions);
  };

  const selectEditAll = () => {
    const newPermissions = {};
    getLeafMenus().forEach((menu) => {
      newPermissions[menu.Id] = {
        view: true,
        add: false,
        edit: true,
        delete: false,
      };
    });
    menus.forEach((menu) => {
      if (hasChildren(menu.Id) && !newPermissions[menu.Id]) {
        newPermissions[menu.Id] = {
          view: false,
          add: false,
          edit: false,
          delete: false,
        };
      }
    });
    setMenuPermissions(newPermissions);
  };

  const selectDeleteAll = () => {
    const newPermissions = {};
    getLeafMenus().forEach((menu) => {
      newPermissions[menu.Id] = {
        view: true,
        add: false,
        edit: false,
        delete: true,
      };
    });
    menus.forEach((menu) => {
      if (hasChildren(menu.Id) && !newPermissions[menu.Id]) {
        newPermissions[menu.Id] = {
          view: false,
          add: false,
          edit: false,
          delete: false,
        };
      }
    });
    setMenuPermissions(newPermissions);
  };

  const deselectAll = () => {
    const newPermissions = {};
    menus.forEach((menu) => {
      newPermissions[menu.Id] = {
        view: false,
        add: false,
        edit: false,
        delete: false,
      };
    });
    setMenuPermissions(newPermissions);
  };

  const getPermissionCount = () => {
    let count = 0;
    getLeafMenus().forEach((menu) => {
      const perms = menuPermissions[menu.Id] || {
        view: false,
        add: false,
        edit: false,
        delete: false,
      };
      if (perms.view) count++;
      if (perms.add) count++;
      if (perms.edit) count++;
      if (perms.delete) count++;
    });
    return count;
  };

  const getTotalPermissions = () => {
    return getLeafMenus().length * 4;
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formData.Full_Name.trim()) {
      setError("Full Name is required.");
      return;
    }

    if (!formData.Email_Address.trim()) {
      setError("Email Address is required.");
      return;
    }

    if (!formData.Phone_Number.trim()) {
      setError("Phone Number is required.");
      return;
    }

    if (!formData.Hire_Date) {
      setError("Hire Date is required.");
      return;
    }

    if (!formData.Role.trim()) {
      setError("Role is required.");
      return;
    }

    // For add mode, validate username and password
    if (!isEdit) {
      if (!formData.Username.trim()) {
        setError("Username is required.");
        return;
      }

      if (!formData.Password) {
        setError("Password is required.");
        return;
      }

      if (formData.Password !== formData.Confirm_Password) {
        setError("Password and Confirm Password do not match.");
        return;
      }
    }

    try {
      setSaving(true);
      const token = localStorage.getItem("crm_access_token");
      const data = new FormData();

      data.append("Full_Name", formData.Full_Name);
      data.append("Designation", formData.Designation);
      data.append("Email_Address", formData.Email_Address);
      data.append("Phone_Number", formData.Phone_Number);
      data.append("Hire_Date", formData.Hire_Date);
      data.append("Role", formData.Role);
      data.append("Is_Active", formData.Is_Active);

      // Only add login fields if not editing
      if (!isEdit) {
        data.append("Username", formData.Username);
        data.append("Password", formData.Password);
        data.append("Confirm_Password", formData.Confirm_Password);
      }

      // Only include permissions for leaf nodes
      const permissionsArray = [];
      getLeafMenus().forEach((menu) => {
        const perms = menuPermissions[menu.Id] || {
          view: false,
          add: false,
          edit: false,
          delete: false,
        };
        if (perms.view || perms.add || perms.edit || perms.delete) {
          permissionsArray.push({
            Menu_Id: menu.Id,
            Can_View: perms.view,
            Can_Add: perms.add,
            Can_Edit: perms.edit,
            Can_Delete: perms.delete,
          });
        }
      });

      data.append("Menu_Permissions", JSON.stringify(permissionsArray));

      if (image) {
        data.append("Staff_Image", image);
      }

      let response;
      if (isEdit) {
        // Update existing staff
        response = await axios.put(`${API_URL}/staff/${editData.Id}/`, data, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });
        setSuccess("Staff updated successfully.");
      } else {
        // Create new staff
        response = await axios.post(`${API_URL}/staff/`, data, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        });
        setSuccess("Staff created successfully.");
      }

      console.log("Staff saved:", response.data);

      // Reset form if not editing
      if (!isEdit) {
        setFormData({
          Full_Name: "",
          Designation: "",
          Email_Address: "",
          Phone_Number: "",
          Hire_Date: "",
          Role: "",
          Is_Active: true,
          Username: "",
          Password: "",
          Confirm_Password: "",
        });

        const initialPermissions = {};
        menus.forEach((menu) => {
          initialPermissions[menu.Id] = {
            view: false,
            add: false,
            edit: false,
            delete: false,
          };
        });
        setMenuPermissions(initialPermissions);
        setImage(null);
        setImagePreview("");
      }

      setTimeout(() => {
        onCancel();
      }, 800);
    } catch (error) {
      console.error("Error saving staff:", error);
      if (error.response?.data) {
        const responseData = error.response.data;
        if (typeof responseData === "object") {
          const messages = Object.entries(responseData)
            .map(([field, value]) => {
              const message = Array.isArray(value) ? value.join(", ") : value;
              return `${field}: ${message}`;
            })
            .join("\n");
          setError(messages);
        } else {
          setError(
            isEdit ? "Unable to update staff." : "Unable to create staff.",
          );
        }
      } else {
        setError("Unable to connect to the server.");
      }
    } finally {
      setSaving(false);
    }
  };

  const renderMenuTree = (menuTree, level = 0) => {
    return menuTree.map((menu) => {
      const hasChildrenFlag = menu.children && menu.children.length > 0;
      const isExpanded = expandedMenus.includes(menu.Id);

      let viewState = false;
      let addState = false;
      let editState = false;
      let deleteState = false;
      let hasPartialView = false;
      let hasPartialAdd = false;
      let hasPartialEdit = false;
      let hasPartialDelete = false;

      if (hasChildrenFlag) {
        viewState = getChildrenPermissionState(menu.Id, "view");
        addState = getChildrenPermissionState(menu.Id, "add");
        editState = getChildrenPermissionState(menu.Id, "edit");
        deleteState = getChildrenPermissionState(menu.Id, "delete");
        hasPartialView =
          getAnyChildPermissionState(menu.Id, "view") && !viewState;
        hasPartialAdd = getAnyChildPermissionState(menu.Id, "add") && !addState;
        hasPartialEdit =
          getAnyChildPermissionState(menu.Id, "edit") && !editState;
        hasPartialDelete =
          getAnyChildPermissionState(menu.Id, "delete") && !deleteState;
      } else {
        const perms = menuPermissions[menu.Id] || {
          view: false,
          add: false,
          edit: false,
          delete: false,
        };
        viewState = perms.view;
        addState = perms.add;
        editState = perms.edit;
        deleteState = perms.delete;
      }

      return (
        <div key={menu.Id} className="menu-permission-row-wrapper">
          <div
            className={`menu-permission-row level-${level}`}
            style={{
              paddingLeft: level === 0 ? "8px" : `${8 + level * 20}px`,
            }}
          >
            <div className="menu-name-cell">
              <div
                className="menu-name-content"
                onClick={() => {
                  if (hasChildrenFlag) {
                    toggleExpand(menu.Id);
                  }
                }}
              >
                {hasChildrenFlag && (
                  <span className="menu-expand-icon">
                    {isExpanded ? "▼" : "▶"}
                  </span>
                )}
                <span className="menu-name">{menu.Menu_Name}</span>
                {level > 0 && <span className="menu-badge">Sub</span>}
              </div>
            </div>

            <div className="permission-cells">
              {hasChildrenFlag ? (
                <>
                  <div
                    className={`permission-indicator ${viewState ? "active" : ""} ${hasPartialView ? "partial" : ""}`}
                  >
                    <span className="indicator-label">View</span>
                    {viewState && <span className="indicator-check">✓</span>}
                    {hasPartialView && (
                      <span className="indicator-partial">◐</span>
                    )}
                  </div>
                  <div
                    className={`permission-indicator ${addState ? "active" : ""} ${hasPartialAdd ? "partial" : ""}`}
                  >
                    <span className="indicator-label">Add</span>
                    {addState && <span className="indicator-check">✓</span>}
                    {hasPartialAdd && (
                      <span className="indicator-partial">◐</span>
                    )}
                  </div>
                  <div
                    className={`permission-indicator ${editState ? "active" : ""} ${hasPartialEdit ? "partial" : ""}`}
                  >
                    <span className="indicator-label">Edit</span>
                    {editState && <span className="indicator-check">✓</span>}
                    {hasPartialEdit && (
                      <span className="indicator-partial">◐</span>
                    )}
                  </div>
                  <div
                    className={`permission-indicator ${deleteState ? "active" : ""} ${hasPartialDelete ? "partial" : ""}`}
                  >
                    <span className="indicator-label">Delete</span>
                    {deleteState && <span className="indicator-check">✓</span>}
                    {hasPartialDelete && (
                      <span className="indicator-partial">◐</span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <label className="permission-checkbox view-perm">
                    <input
                      type="checkbox"
                      checked={viewState}
                      onChange={(e) =>
                        handlePermissionChange(
                          menu.Id,
                          PERMISSION_TYPES.VIEW,
                          e.target.checked,
                        )
                      }
                    />
                    <span className="checkmark"></span>
                    <span className="perm-label">View</span>
                  </label>

                  <label className="permission-checkbox add-perm">
                    <input
                      type="checkbox"
                      checked={addState}
                      onChange={(e) =>
                        handlePermissionChange(
                          menu.Id,
                          PERMISSION_TYPES.ADD,
                          e.target.checked,
                        )
                      }
                    />
                    <span className="checkmark"></span>
                    <span className="perm-label">Add</span>
                  </label>

                  <label className="permission-checkbox edit-perm">
                    <input
                      type="checkbox"
                      checked={editState}
                      onChange={(e) =>
                        handlePermissionChange(
                          menu.Id,
                          PERMISSION_TYPES.EDIT,
                          e.target.checked,
                        )
                      }
                    />
                    <span className="checkmark"></span>
                    <span className="perm-label">Edit</span>
                  </label>

                  <label className="permission-checkbox delete-perm">
                    <input
                      type="checkbox"
                      checked={deleteState}
                      onChange={(e) =>
                        handlePermissionChange(
                          menu.Id,
                          PERMISSION_TYPES.DELETE,
                          e.target.checked,
                        )
                      }
                    />
                    <span className="checkmark"></span>
                    <span className="perm-label">Delete</span>
                  </label>
                </>
              )}
            </div>
          </div>

          {hasChildrenFlag && isExpanded && (
            <div className="menu-children">
              {renderMenuTree(menu.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const menuTree = buildMenuTree(menus);
  const filteredTree = filterMenuTree(menuTree, searchTerm);
  const selectedCount = getPermissionCount();
  const totalPermissions = getTotalPermissions();

  if (loading) {
    return (
      <div className="add-staff-page">
        <div className="loading-container">
          <div className="spinner-large"></div>
          <p>Loading staff data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="add-staff-page">
      {/* HEADER */}
      <div className="add-staff-header">
        <div className="header-content">
          <div className="header-left">
            <h1>{isEdit ? "Edit Staff Member" : "Add Staff Member"}</h1>
            <p>
              {isEdit
                ? "Update staff information and system access permissions"
                : "Create a new staff account and configure system access permissions"}
            </p>
          </div>
          <div className="header-badge">
            <span className={`badge ${isEdit ? "edit" : ""}`}>
              {isEdit ? "Edit" : "New"}
            </span>
          </div>
        </div>
      </div>

      <form className="add-staff-form" onSubmit={handleSubmit}>
        {/* PERSONAL DETAILS */}
        <div className="staff-form-card">
          <div className="form-card-header">
            <div className="form-card-header-left">
              <span className="form-card-icon">👤</span>
              <div>
                <h2>Personal Details</h2>
                <p>Basic information about the staff member</p>
              </div>
            </div>
          </div>

          <div className="form-card-body">
            <div className="staff-image-section">
              <div className="staff-image-preview">
                {imagePreview ? (
                  <img src={imagePreview} alt="Staff preview" />
                ) : (
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <circle
                      cx="20"
                      cy="15"
                      r="10"
                      stroke="#9CA3AF"
                      strokeWidth="2"
                    />
                    <path
                      d="M4 36C4 28.268 10.268 22 18 22H22C29.732 22 36 28.268 36 36V36"
                      stroke="#9CA3AF"
                      strokeWidth="2"
                    />
                  </svg>
                )}
              </div>

              <div className="staff-image-upload">
                <label className="image-upload-button">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M8 3V13M3 8H13"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  {isEdit ? "Change Photo" : "Upload Photo"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                </label>
                <small>JPG, PNG or WEBP • Max 2MB</small>
              </div>
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label>
                  Full Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="Full_Name"
                  value={formData.Full_Name}
                  onChange={handleChange}
                  placeholder="Enter full name"
                  className="form-input"
                />
              </div>

              <div className="form-field">
                <label>
                  Phone Number <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="Phone_Number"
                  value={formData.Phone_Number}
                  onChange={handleChange}
                  placeholder="+1 234 567 890"
                  className="form-input"
                />
              </div>

              <div className="form-field">
                <label>
                  Email Address <span className="required">*</span>
                </label>
                <input
                  type="email"
                  name="Email_Address"
                  value={formData.Email_Address}
                  onChange={handleChange}
                  placeholder="name@company.com"
                  className="form-input"
                />
              </div>

              <div className="form-field">
                <label>Designation</label>
                <input
                  type="text"
                  name="Designation"
                  value={formData.Designation}
                  onChange={handleChange}
                  placeholder="e.g. Senior Developer"
                  className="form-input"
                />
              </div>
            </div>
          </div>
        </div>

        {/* EMPLOYEE DETAILS */}
        <div className="staff-form-card">
          <div className="form-card-header">
            <div className="form-card-header-left">
              <span className="form-card-icon">💼</span>
              <div>
                <h2>Employee Details</h2>
                <p>Staff role and employment information</p>
              </div>
            </div>
          </div>

          <div className="form-card-body">
            <div className="form-grid">
              <div className="form-field">
                <label>
                  Hire Date <span className="required">*</span>
                </label>
                <input
                  type="date"
                  name="Hire_Date"
                  value={formData.Hire_Date}
                  onChange={handleChange}
                  className="form-input"
                />
              </div>

              <div className="form-field">
                <label>
                  Role <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="Role"
                  value={formData.Role}
                  onChange={handleChange}
                  placeholder="e.g. Admin / Manager"
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-toggle-group">
              <label className="active-toggle">
                <input
                  type="checkbox"
                  name="Is_Active"
                  checked={formData.Is_Active}
                  onChange={handleChange}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-label">Staff is Active</span>
              </label>
            </div>
          </div>
        </div>

        {/* LOGIN CREDENTIALS - Only show for Add mode */}
        {!isEdit && (
          <div className="staff-form-card">
            <div className="form-card-header">
              <div className="form-card-header-left">
                <span className="form-card-icon">🔐</span>
                <div>
                  <h2>Login Credentials</h2>
                  <p>Secure login credentials for system access</p>
                </div>
              </div>
            </div>

            <div className="form-card-body">
              <div className="form-grid">
                <div className="form-field">
                  <label>
                    Username <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    name="Username"
                    value={formData.Username}
                    onChange={handleChange}
                    placeholder="Choose a username"
                    autoComplete="off"
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label>
                    Password <span className="required">*</span>
                  </label>
                  <input
                    type="password"
                    name="Password"
                    value={formData.Password}
                    onChange={handleChange}
                    placeholder="Min 6 characters"
                    autoComplete="new-password"
                    className="form-input"
                  />
                </div>

                <div className="form-field">
                  <label>
                    Confirm Password <span className="required">*</span>
                  </label>
                  <input
                    type="password"
                    name="Confirm_Password"
                    value={formData.Confirm_Password}
                    onChange={handleChange}
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    className="form-input"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MENU PERMISSIONS */}
        <div className="staff-form-card permission-card">
          <div className="form-card-header permission-header">
            <div className="form-card-header-left">
              <span className="form-card-icon">📋</span>
              <div>
                <h2>Menu Permissions</h2>
                <p>Select the menus this staff member can access</p>
              </div>
            </div>
            <div className="permission-stats">
              <span className="stat-item">
                <span className="stat-number">{selectedCount}</span>
                <span className="stat-label">SELECTED</span>
              </span>
              <span className="stat-divider">/</span>
              <span className="stat-item">
                <span className="stat-number">{totalPermissions}</span>
                <span className="stat-label">TOTAL</span>
              </span>
            </div>
          </div>

          <div className="form-card-body">
            <div className="permission-note">
              <span className="note-icon">ℹ️</span>
              <span className="note-text">
                Parent menus show the combined permission state of their
                sub-menus. Click on parent menus to expand/collapse. Select
                permissions on individual sub-menus to grant access.
              </span>
            </div>

            <div className="permission-toolbar">
              <div className="permission-search">
                <svg
                  className="search-icon"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M7.333 12.667C10.2785 12.667 12.666 10.2785 12.666 7.333C12.666 4.38752 10.2785 2 7.333 2C4.38752 2 2 4.38752 2 7.333C2 10.2785 4.38752 12.667 7.333 12.667Z"
                    stroke="#9CA3AF"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M14 14L11.1 11.1"
                    stroke="#9CA3AF"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Search menu..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
              <div className="permission-actions">
                <button
                  type="button"
                  className="action-btn select-all"
                  onClick={selectAllPermissions}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="action-btn"
                  onClick={selectViewAll}
                >
                  All View
                </button>
                <button
                  type="button"
                  className="action-btn"
                  onClick={selectAddAll}
                >
                  + All Add
                </button>
                <button
                  type="button"
                  className="action-btn"
                  onClick={selectEditAll}
                >
                  All Edit
                </button>
                <button
                  type="button"
                  className="action-btn"
                  onClick={selectDeleteAll}
                >
                  All Delete
                </button>
                <button
                  type="button"
                  className="action-btn clear-all"
                  onClick={deselectAll}
                >
                  Deselect All
                </button>
              </div>
            </div>

            <div className="permission-table-container">
              <div className="permission-table-header">
                <div className="menu-name-header">MENU</div>
                <div className="permission-headers">
                  <span className="perm-header view-header">VIEW</span>
                  <span className="perm-header add-header">ADD</span>
                  <span className="perm-header edit-header">EDIT</span>
                  <span className="perm-header delete-header">DELETE</span>
                </div>
              </div>

              <div className="permission-table-body">
                {menus.length === 0 ? (
                  <div className="no-menus">
                    <span className="no-menus-icon">📭</span>
                    <p>No active menus available</p>
                  </div>
                ) : filteredTree.length === 0 ? (
                  <div className="no-menus">
                    <span className="no-menus-icon">🔍</span>
                    <p>No menus found matching "{searchTerm}"</p>
                  </div>
                ) : (
                  renderMenuTree(filteredTree)
                )}
              </div>
            </div>
          </div>
        </div>

        {/* MESSAGES */}
        {error && (
          <div className="add-staff-error">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle
                cx="10"
                cy="10"
                r="8"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M10 6V10M10 14H10.01"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <div className="error-content">
              <strong>Error</strong>
              <span>{error}</span>
            </div>
          </div>
        )}

        {success && (
          <div className="add-staff-success">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle
                cx="10"
                cy="10"
                r="8"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M6 10L9 13L14 7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <div className="success-content">
              <strong>Success</strong>
              <span>{success}</span>
            </div>
          </div>
        )}

        {/* ACTIONS */}
        <div className="staff-form-actions">
          <button
            type="button"
            className="cancel-staff-button"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="submit" className="save-staff-button" disabled={saving}>
            {saving ? (
              <>
                <span className="spinner"></span>
                {isEdit ? "Updating..." : "Saving..."}
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path
                    d="M3 9L7 13L15 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                {isEdit ? "Update Staff" : "Save Staff"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddStaff;
