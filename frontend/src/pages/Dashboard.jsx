import { useState, useEffect } from "react";
import "../styles/Dashboard.css";

import ProductTypeMaster from "./ProductTypeMaster";
import CustomerTypeMaster from "./CustomerTypeMaster";
import StatusTypeMaster from "./StatusTypeMaster";
import SourceTypeMaster from "./SourceTypeMaster";
import RatingTypeMaster from "./RatingTypeMaster";
import LicenseTypeMaster from "./LicenseTypeMaster";

import CustomerList from "./Customers/CustomerList";
import AddCustomer from "./Customers/AddCustomer";

import InquiryPage from "./Inquiry/InquiryPage";
import InquiryList from "./Inquiry/InquiryList";

import StaffList from "./Staff/StaffList";
import AddStaff from "./Staff/AddStaff";

import Schedule from "./Schedule/Schedule";
import ScheduleDetail from "./Schedule/ScheduleDetail";
import PaymentApproval from "./PaymentApproval";
import PaymentReceivedDetails from "./PaymentReceivedDetails";
import PaymentPending from "./PaymentPending";
import CompletedInquiryReport from "./CompletedInquiryReport/CompletedInquiryReport.jsx";
import {
  canViewPaymentApproval,
  canViewPaymentPending,
} from "./paymentApprovalAccess";
import TaskReminder from "../TaskReminder";

import { createStaffMode, editStaffMode } from "./Staff/staffNavigation";
import {
  buildMenuAccess,
  hasFullMenuAccess,
  loadActiveMenu,
  saveActiveMenu,
  selectInitialMenu,
} from "../menuAccess";

const normalizeRole = (role = "") =>
  String(role).trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");

const normalizeMenuName = (name = "") =>
  String(name).trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");

const isPaymentReceivedReportMenu = (menuName) => {
  const normalized = normalizeMenuName(menuName);

  return (
    [
      "payment received report",
      "payment received details",
      "payment received details report",
      "payement details report",
      "payment details report",
    ].includes(normalized) ||
    (normalized.includes("payment received") && normalized.includes("report"))
  );
};

/* =========================================================
   ICON COMPONENT
========================================================= */

const Icon = ({ name, size = 18 }) => {
  const paths = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    briefcase: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" />
      </>
    ),
    tasks: (
      <>
        <path d="m3 7 2 2 4-4M3 17l2 2 4-4M13 7h8M13 17h8" />
      </>
    ),
    chart: (
      <>
        <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    arrowUp: <path d="m18 15-6-6-6 6" />,
    arrowRight: <path d="M5 12h14m-5-5 5 5-5 5" />,
    more: (
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <circle cx="19" cy="12" r="1" fill="currentColor" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </>
    ),
    list: (
      <>
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </>
    ),
    dollar: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M8 8h4a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3h-4" />
        <path d="M8 14h5a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3H8" />
        <line x1="12" y1="5" x2="12" y2="19" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
    check: <polyline points="20 6 9 17 4 12" />,
    message: (
      <>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </>
    ),
    phone: (
      <>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
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
      aria-hidden="true"
    >
      {paths[name] || paths.menu}
    </svg>
  );
};

/* =========================================================
   DASHBOARD
========================================================= */

function Dashboard() {
  /* -------------------------------------------------------
     STATES
  ------------------------------------------------------- */

  const [active, setActive] = useState(() => loadActiveMenu(sessionStorage));
  const [menus, setMenus] = useState([]);
  const [openMenus, setOpenMenus] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [greeting, setGreeting] = useState("");
  const [greetingEmoji, setGreetingEmoji] = useState("");
  const [staffId, setStaffId] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [selectedScheduleInquiryId, setSelectedScheduleInquiryId] =
    useState(null);
  const [autoStartScheduleTask, setAutoStartScheduleTask] = useState(false);
  const [isLoadingMenus, setIsLoadingMenus] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allowedMenuIds, setAllowedMenuIds] = useState([]);
  const [menuAccess, setMenuAccess] = useState({});

  // Dashboard data states
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalInquiries: 0,
    totalRevenue: 0,
    notStartedInquiries: 0,
    inProgressSchedules: 0,
    completedSchedules: 0,
    completedRevenue: 0,
    dashboardInquiries: [],
  });
  const [loading, setLoading] = useState(true);
  const dashboardRole = normalizeRole(user?.role || user?.user_type);
  const isSuperAdmin = dashboardRole === "super admin";

  // List of all page/menu names where FAB should NOT appear
  const nonDashboardPages = [
    "Customer List",
    "Staff List",
    "Add Staff",
    "Add Customer",
    "Inquiry List",
    "Add Inquiry",
    "Product Type Master",
    "Customer Type Master",
    "Status Type Master",
    "Source Type Master",
    "Rating Type Master",
    "License Type Master",
    "Schedule",
    "Schedule Detail",
    "Completed Inquery Report",
    "Completed Inquiry Detail",
    "Payment Approval",
    "Payment Pending",
    "Payment Received Details",
    "Payment Received Report",
    "Payement Details Report",
  ];

  // Check if we're on the dashboard (home page)
  const isDashboardPage =
    active === "" ||
    active === "Dashboard" ||
    (active && !nonDashboardPages.includes(active));

  useEffect(() => {
    saveActiveMenu(active, sessionStorage);
  }, [active]);

  /* =======================================================
     LOAD USER + GREETING + STAFF PERMISSIONS
  ======================================================= */

  useEffect(() => {
    const userData = localStorage.getItem("crm_user");
    console.log("📦 User data from localStorage:", userData);

    if (userData) {
      try {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);

        // Check if user is admin
        const role = (
          parsedUser.role ||
          parsedUser.user_type ||
          ""
        ).toLowerCase();
        const isAdminUser = hasFullMenuAccess(parsedUser);
        setIsAdmin(isAdminUser);

        console.log(
          `👤 User: ${parsedUser.name || parsedUser.username || parsedUser.full_name}`,
        );
        console.log(`🔑 Role: ${role || "Not specified"}`);
        console.log(`👑 Is Admin: ${isAdminUser}`);

        // Try multiple possible field names for staff ID
        const id =
          parsedUser.staff_id ||
          parsedUser.id ||
          parsedUser.Staff_Id ||
          parsedUser.user_id;

        if (id && !isAdminUser) {
          setStaffId(id);
          console.log(`🆔 Staff ID: ${id}`);
        } else if (isAdminUser) {
          console.log("👑 Admin user - will show all menus");
          setStaffId(null);
        } else {
          console.log(
            "⚠️ No staff ID found. Available fields:",
            Object.keys(parsedUser),
          );
        }
      } catch (error) {
        console.error("❌ Error parsing user data:", error);
      }
    } else {
      console.log("⚠️ No user data found in localStorage");
    }

    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      setGreeting("Good morning");
      setGreetingEmoji("🌅");
    } else if (hour >= 12 && hour < 17) {
      setGreeting("Good afternoon");
      setGreetingEmoji("☀️");
    } else if (hour >= 17 && hour < 21) {
      setGreeting("Good evening");
      setGreetingEmoji("🌆");
    } else {
      setGreeting("Good night");
      setGreetingEmoji("🌙");
    }
  }, []);

  /* =======================================================
     LOAD MENUS AND PERMISSIONS
  ======================================================= */

  useEffect(() => {
    const fetchMenusAndPermissions = async () => {
      setIsLoadingMenus(true);

      try {
        const token = localStorage.getItem("crm_access_token");
        if (!token) {
          console.log("❌ No access token found");
          setIsLoadingMenus(false);
          return;
        }

        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };

        // Step 1: Fetch all active menus
        console.log("📡 Fetching all active menus...");
        const menuResponse = await fetch(
          "http://127.0.0.1:8000/api/staff/my-menus/",
          {
            method: "GET",
            headers,
          },
        );

        if (!menuResponse.ok) {
          throw new Error(`Menu API Error: ${menuResponse.status}`);
        }

        const allMenus = await menuResponse.json();
        let loggedInUser = {};
        try {
          loggedInUser = JSON.parse(localStorage.getItem("crm_user") || "{}");
        } catch {
          loggedInUser = {};
        }
        const loggedInRole = normalizeRole(
          loggedInUser.role || loggedInUser.user_type,
        );
        const isSuperAdmin = loggedInRole === "super admin";
        const isAdmin = loggedInRole === "admin";
        const canViewPaymentApprovalMenu = canViewPaymentApproval(loggedInUser);
        const canViewPaymentPendingMenu = canViewPaymentPending(loggedInUser);
        const canViewPaymentReceivedMenu = isSuperAdmin || isAdmin;
        const activeMenus = allMenus
          .filter((menu) => menu.Is_Active === true)
          .filter((menu) => {
            const isPaymentApproval = menu.Menu_Name === "Payment Approval";
            const isPaymentPending = menu.Menu_Name === "Payment Pending";
            const isPaymentReceivedReport = isPaymentReceivedReportMenu(
              menu.Menu_Name,
            );

            if (!isPaymentApproval && !isPaymentPending && !isPaymentReceivedReport) {
              return true;
            }

            if (isPaymentApproval) return canViewPaymentApprovalMenu;
            if (isPaymentPending) return canViewPaymentPendingMenu;
            return canViewPaymentReceivedMenu;
          });

        console.log(`📋 Total active menus: ${activeMenus.length}`);
        console.log(
          "📋 All menus:",
          activeMenus.map((m) => ({
            id: m.Id,
            name: m.Menu_Name,
            parent: m.parent_id,
          })),
        );

        let filteredMenus = activeMenus;
        let finalAllowedIds = activeMenus.map((menu) => menu.Id);

        // Step 2: Full-access users can see every active menu.
        if (isSuperAdmin) {
          console.log("👑 Super Admin user - showing all permitted menus");
        }
        // Step 3: If staff has ID, try to fetch permissions
        else if (false) {
          try {
            console.log(`📡 Fetching permissions for staff ID: ${staffId}`);

            // Try to fetch from API
            const permissionResponse = await fetch(
              `http://127.0.0.1:8000/api/staff-permissions/?staff_id=${staffId}`,
              {
                method: "GET",
                headers,
              },
            );

            let allowedIds = [];

            if (permissionResponse.ok) {
              const permissions = await permissionResponse.json();
              console.log(
                `🔑 Staff ${staffId} permissions from API:`,
                permissions,
              );

              // Get allowed menu IDs (where Can_View is true)
              allowedIds = permissions
                .filter((perm) => perm.Can_View === 1 || perm.Can_View === true)
                .map((perm) => perm.Menu_Id);

              console.log(`📋 Menu IDs with View permission:`, allowedIds);
            } else {
              console.warn(
                `Permission API returned ${permissionResponse.status}; denying menu access`,
              );
              allowedIds = [];
            }

            finalAllowedIds = allowedIds;

            // Step 4: Filter menus based on permissions
            if (allowedIds.length > 0) {
              // First, get only the menus the user has direct permission for
              let directMenus = activeMenus.filter((menu) =>
                allowedIds.includes(menu.Id),
              );

              console.log(`✅ Direct menu access: ${directMenus.length}`);

              // Now, find parent menus that are ALSO in the allowed list
              // We only want to show a parent menu if the user has permission for it
              const parentMenuIds = new Set();
              directMenus.forEach((menu) => {
                if (menu.parent_id) {
                  // Only add parent if parent is in the allowedIds
                  if (allowedIds.includes(menu.parent_id)) {
                    parentMenuIds.add(menu.parent_id);
                  }
                }
              });

              // Add parent menus to the filtered list (only if they are in allowedIds)
              parentMenuIds.forEach((parentId) => {
                if (!directMenus.some((m) => m.Id === parentId)) {
                  const parentMenu = activeMenus.find((m) => m.Id === parentId);
                  if (parentMenu) {
                    directMenus.push(parentMenu);
                    console.log(
                      `📁 Added parent menu: ${parentMenu.Menu_Name} (ID: ${parentMenu.Id}) - User has permission for this parent`,
                    );
                  }
                }
              });

              filteredMenus = directMenus;
            } else {
              // If NO permissions found, show EMPTY menu list (not all menus)
              console.log(
                "⚠️ No permissions found for this staff member - showing NO menus",
              );
              filteredMenus = [];
            }
          } catch (error) {
            console.error("❌ Error fetching staff permissions:", error);
            // On error, show NO menus (not all menus)
            filteredMenus = [];
            finalAllowedIds = [];
          }
        }

        // Step 5: Set the filtered menus and allowed IDs
        console.log(
          `✅ Final menus to display (${filteredMenus.length}):`,
          filteredMenus.map((m) => ({ id: m.Id, name: m.Menu_Name })),
        );

        setMenus(filteredMenus);
        setAllowedMenuIds(finalAllowedIds);
        setMenuAccess(buildMenuAccess(filteredMenus));
        setActive((current) => selectInitialMenu(filteredMenus, current));

        // Step 6: All menus are closed by default
        setOpenMenus({});
      } catch (error) {
        console.error("❌ Error loading menus:", error);
        // On error, show empty menu list
        setMenus([]);
        setAllowedMenuIds([]);
      } finally {
        setIsLoadingMenus(false);
      }
    };

    fetchMenusAndPermissions();
  }, [staffId, isAdmin]);

  /* =======================================================
     FETCH DASHBOARD DATA
  ======================================================= */

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("crm_access_token");
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        };

        const today = new Date();
        const localDate = [
          today.getFullYear(),
          String(today.getMonth() + 1).padStart(2, "0"),
          String(today.getDate()).padStart(2, "0"),
        ].join("-");

        // Fetch stats for the browser's local date.
        const statsResponse = await fetch(
          `http://127.0.0.1:8000/api/dashboard-stats/?date=${localDate}`,
          { headers },
        );
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();

    const refreshDashboard = () => {
      if (document.visibilityState === "visible") {
        fetchDashboardData();
      }
    };
    window.addEventListener("focus", refreshDashboard);
    document.addEventListener("visibilitychange", refreshDashboard);

    return () => {
      window.removeEventListener("focus", refreshDashboard);
      document.removeEventListener("visibilitychange", refreshDashboard);
    };
  }, []);

  /* =======================================================
     PARENT MENUS
  ======================================================= */

  const displayMenus = (() => {
    const paymentReceivedMenu = menus.find((menu) =>
      isPaymentReceivedReportMenu(menu.Menu_Name),
    );
    if (
      !paymentReceivedMenu ||
      menus.some((menu) => menu.Menu_Name === "Reports")
    ) {
      return menus;
    }

    return [
      ...menus.filter(
        (menu) => !isPaymentReceivedReportMenu(menu.Menu_Name),
      ),
      {
        Id: "reports-root",
        Menu_Name: "Reports",
        parent_id: null,
        Display_Order: 9999,
        Icon: "chart",
      },
      {
        ...paymentReceivedMenu,
        parent_id: "reports-root",
      },
    ];
  })();

  const parentMenus = displayMenus
    .filter((menu) => menu.parent_id === null)
    .sort((a, b) => a.Display_Order - b.Display_Order);

  const getChildMenus = (parentId) => {
    return displayMenus
      .filter((menu) => menu.parent_id === parentId)
      .sort((a, b) => a.Display_Order - b.Display_Order);
  };

  // Toggle menu with accordion behavior
  const toggleMenu = (menuId) => {
    setOpenMenus((previous) => {
      const newState = {};
      const isCurrentlyOpen = previous[menuId] || false;
      if (!isCurrentlyOpen) {
        newState[menuId] = true;
      }
      return newState;
    });
  };

  const getUserInitials = () => {
    if (!user) return "GU";
    const name = user.name || user.full_name || user.username || "Guest User";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getUserName = () => {
    if (!user) return "Guest User";
    return user.name || user.full_name || user.username || "Guest User";
  };

  const getUserRole = () => {
    if (!user) return "User";
    return user.role || user.user_type || "User";
  };

  const handleLogout = () => {
    sessionStorage.removeItem("crm_active_menu");
    localStorage.removeItem("crm_access_token");
    localStorage.removeItem("crm_refresh_token");
    localStorage.removeItem("crm_user");
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.replace("/login");
  };

  const handleAddInquiry = () => {
    setSelectedInquiry(null);
    setActive("Add Inquiry");
  };

  const handleAddCustomer = () => {
    setActive("Add Customer");
  };

  const handleAddStaff = () => {
    const mode = createStaffMode();
    setSelectedStaff(mode.selectedStaff);
    setActive(mode.active);
  };

  const handleEditStaff = (staff) => {
    const mode = editStaffMode(staff);
    setSelectedStaff(mode.selectedStaff);
    setActive(mode.active);
  };

  const handleMenuNavigation = (menuName) => {
    if (menuName === "Add Staff") {
      handleAddStaff();
      return;
    }

    setActive(menuName);
  };

  const handleViewInquiry = (inquiry) => {
    return inquiry;
  };

  const handleEditInquiry = (inquiry) => {
    setSelectedInquiry(inquiry);
    setActive("Add Inquiry");
  };

  const handleViewScheduleDetail = (inquiryId, options = {}) => {
    setSelectedScheduleInquiryId(inquiryId);
    setAutoStartScheduleTask(Boolean(options.autoStartTask));
    setActive("Schedule Detail");
  };

  const handleViewCompletedInquiry = (inquiryId) => {
    setSelectedScheduleInquiryId(inquiryId);
    setAutoStartScheduleTask(false);
    setActive("Completed Inquiry Detail");
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="dashboard-shell">
      <TaskReminder onOpenInquiry={handleViewScheduleDetail} />
      <aside className={`sidebar ${sidebarOpen ? "is-open" : ""}`}>
        <div className="side-brand">
          <div className="dash-logo">CRM</div>
          <div>
            <strong>Sai Infosys CRM</strong>
            <span>Customer Relationship Management</span>
          </div>
          <button
            className="side-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <Icon name="close" />
          </button>
        </div>

        <nav className="side-nav" aria-label="Main navigation">
          {isLoadingMenus ? (
            <div
              style={{
                padding: "20px",
                color: "#64748b",
                fontSize: "12px",
                textAlign: "center",
              }}
            >
              Loading menus...
            </div>
          ) : parentMenus.length === 0 ? (
            <div
              style={{
                padding: "20px",
                color: "#64748b",
                fontSize: "12px",
                textAlign: "center",
              }}
            >
              {staffId && !isAdmin
                ? "You don't have access to any menus"
                : "No menus available"}
            </div>
          ) : (
            parentMenus.map((parent) => {
              const children = getChildMenus(parent.Id);
              const hasChildren = children.length > 0;
              const isOpen = openMenus[parent.Id] || false;

              return (
                <div key={parent.Id}>
                  <button
                    className={active === parent.Menu_Name ? "active" : ""}
                    onClick={() => {
                      if (hasChildren) {
                        toggleMenu(parent.Id);
                      } else {
                        handleMenuNavigation(parent.Menu_Name);
                        setSidebarOpen(false);
                      }
                    }}
                  >
                    <Icon name={parent.Icon || "menu"} />
                    <span>{parent.Menu_Name}</span>
                    {hasChildren && (
                      <span
                        className="menu-arrow"
                        style={{
                          marginLeft: "auto",
                          fontSize: "14px",
                        }}
                      >
                        {isOpen ? "⌃" : "⌄"}
                      </span>
                    )}
                  </button>

                  {hasChildren && isOpen && (
                    <div className="submenu">
                      {children.map((child) => (
                        <button
                          key={child.Id}
                          className={active === child.Menu_Name ? "active" : ""}
                          onClick={() => {
                            handleMenuNavigation(child.Menu_Name);
                            setSidebarOpen(false);
                          }}
                        >
                          <span>{child.Menu_Name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <span>✨</span>
            <strong>Need a hand?</strong>
            <p>Explore our help center and guides.</p>
            <a href="#help">Visit help center</a>
          </div>

          <div className="side-user">
            <span>{getUserInitials()}</span>
            <div>
              <strong>{getUserName()}</strong>
              <small>{getUserRole()}</small>
            </div>
            <button aria-label="More options">
              <Icon name="more" />
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        />
      )}

      <main className="dashboard-main">
        <header className="topbar">
          <button
            className="menu-toggle"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Icon name="menu" />
          </button>

          <div className="top-actions">
            <button className="icon-button" aria-label="Notifications">
              <Icon name="bell" />
              <i />
            </button>

            <div className="top-user">
              <span>{getUserInitials()}</span>
              <div>
                <strong>{getUserName()}</strong>
                <small>{getUserRole()}</small>
              </div>
              <span className="chevron">⌄</span>
            </div>

            <button className="logout-btn-top" onClick={handleLogout}>
              <Icon name="logout" size={16} />
              Logout
            </button>
          </div>
        </header>

        <div className="dashboard-content">
          {active === "" ? (
            <section className="page-heading">
              <div>
                <h1>No menu access</h1>
                <p>Contact an administrator to request menu permission.</p>
              </div>
            </section>
          ) : active === "Customer List" ? (
            <CustomerList
              permissions={menuAccess["Customer List"]}
              onAddCustomer={handleAddCustomer}
            />
          ) : active === "Staff List" ? (
            <StaffList
              onAddStaff={handleAddStaff}
              onEditStaff={handleEditStaff}
              permissions={menuAccess["Staff List"]}
            />
          ) : active === "Add Staff" ? (
            <AddStaff
              editData={selectedStaff}
              isEdit={Boolean(selectedStaff)}
              onCancel={() => {
                setSelectedStaff(null);
                setActive("Staff List");
              }}
            />
          ) : active === "Add Customer" ? (
            <AddCustomer />
          ) : active === "Inquiry List" ? (
            <InquiryList
              onAddInquiry={handleAddInquiry}
              onViewInquiry={handleViewInquiry}
              onEditInquiry={handleEditInquiry}
              permissions={menuAccess["Inquiry List"]}
            />
          ) : active === "Add Inquiry" ? (
            <InquiryPage
              editData={selectedInquiry}
              isEdit={Boolean(selectedInquiry)}
              onCancel={() => {
                setSelectedInquiry(null);
                setActive("Inquiry List");
              }}
            />
          ) : active === "Product Type Master" ? (
            <ProductTypeMaster
              permissions={menuAccess["Product Type Master"]}
            />
          ) : active === "Customer Type Master" ? (
            <CustomerTypeMaster
              permissions={menuAccess["Customer Type Master"]}
            />
          ) : active === "Status Type Master" ? (
            <StatusTypeMaster permissions={menuAccess["Status Type Master"]} />
          ) : active === "Source Type Master" ? (
            <SourceTypeMaster permissions={menuAccess["Source Type Master"]} />
          ) : active === "Rating Type Master" ? (
            <RatingTypeMaster permissions={menuAccess["Rating Type Master"]} />
          ) : active === "License Type Master" ? (
            <LicenseTypeMaster
              permissions={menuAccess["License Type Master"]}
            />
          ) : active === "Schedule" ? (
            <Schedule
              permissions={menuAccess["Schedule"]}
              onViewDetails={handleViewScheduleDetail}
            />
          ) : active === "Schedule Detail" ? (
            <ScheduleDetail
              inquiryId={selectedScheduleInquiryId}
              onBack={() => {
                setSelectedScheduleInquiryId(null);
                setAutoStartScheduleTask(false);
                setActive("Schedule");
              }}
              autoStartTask={autoStartScheduleTask}
            />
          ) : active === "Completed Inquery Report" ? (
            <CompletedInquiryReport
              onViewDetails={handleViewCompletedInquiry}
            />
          ) : active === "Completed Inquiry Detail" ? (
            <ScheduleDetail
              inquiryId={selectedScheduleInquiryId}
              onBack={() => {
                setSelectedScheduleInquiryId(null);
                setActive("Completed Inquery Report");
              }}
            />
          ) : active === "Payment Approval" ? (
            <PaymentApproval />
          ) : active === "Payment Pending" ? (
            <PaymentPending />
          ) : isPaymentReceivedReportMenu(active) ? (
            <PaymentReceivedDetails />
          ) : (
            // DASHBOARD CONTENT - This is the home page
            <>
              <section className="page-heading">
                <div>
                  <h1>
                    {greeting} {greetingEmoji}
                  </h1>
                  <small>
                    Here's what's happening with your business today.
                  </small>
                </div>
              </section>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-top">
                    <div className="stat-icon violet">
                      <Icon name="users" size={16} />
                    </div>
                  </div>
                  <p>
                    {isSuperAdmin ? "Total Customers" : "Not Started Schedules"}
                  </p>
                  <div className="stat-value">
                    {isSuperAdmin
                      ? stats.totalCustomers
                      : stats.notStartedInquiries}
                  </div>
                  <small>
                    {isSuperAdmin ? (
                      <b>All customers</b>
                    ) : (
                      <b>Pending task start</b>
                    )}
                  </small>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <div className="stat-icon blue">
                      <Icon name="message" size={16} />
                    </div>
                  </div>
                  <p>
                    {isSuperAdmin ? "Total Inquiries" : "In Progress Schedules"}
                  </p>
                  <div className="stat-value">
                    {isSuperAdmin
                      ? stats.totalInquiries
                      : stats.inProgressSchedules}
                  </div>
                  <small>
                    {isSuperAdmin ? (
                      <b>All inquiries</b>
                    ) : (
                      <b>Currently active</b>
                    )}
                  </small>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <div className="stat-icon green">
                      <Icon name="briefcase" size={16} />
                    </div>
                  </div>
                  <p>
                    {isSuperAdmin
                      ? "Not Started Inquiries"
                      : "Completed Schedules"}
                  </p>
                  <div className="stat-value">
                    {isSuperAdmin
                      ? stats.notStartedInquiries
                      : stats.completedSchedules}
                  </div>
                  <small>
                    {isSuperAdmin ? <b>Pending</b> : <b>Finished schedules</b>}
                  </small>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <div className="stat-icon orange">
                      <Icon name="dollar" size={16} />
                    </div>
                  </div>
                  <p>
                    {isSuperAdmin
                      ? "Total Revenue Amount"
                      : "Completed Revenue"}
                  </p>
                  <div className="stat-value">
                    ₹
                    {Number(
                      isSuperAdmin
                        ? stats.totalRevenue
                        : stats.completedRevenue,
                    ).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <small>
                    {isSuperAdmin ? (
                      <b>All revenue</b>
                    ) : (
                      <b>From completed schedules</b>
                    )}
                  </small>
                </div>
              </div>

              <section className="dashboard-inquiries-panel">
                <div className="dashboard-inquiries-header">
                  <div>
                    <h2>
                      {isAdmin
                        ? "Today's inquiries"
                        : "Today's inquiries & not started"}
                    </h2>
                    <p>
                      {isAdmin
                        ? "All staff schedules for today"
                        : "Your assigned schedules, including overdue work"}
                    </p>
                  </div>
                  <span>{stats.dashboardInquiries?.length || 0} inquiries</span>
                </div>
                {stats.dashboardInquiries?.length ? (
                  <div className="dashboard-inquiries-list">
                    {stats.dashboardInquiries.map((inquiry) => (
                      <button
                        type="button"
                        className={`dashboard-inquiry-row ${
                          inquiry.is_not_started
                            ? "dashboard-inquiry-row-not-started"
                            : ""
                        }`}
                        key={inquiry.id}
                        onClick={() => handleViewScheduleDetail(inquiry.id)}
                      >
                        <span className="dashboard-inquiry-date">
                          {inquiry.schedule_date || "No date"}
                        </span>
                        <div className="dashboard-inquiry-main">
                          <strong>{inquiry.customer_name || "Unknown customer"}</strong>
                          <small>
                            {isAdmin
                              ? `Assigned to ${inquiry.resource_name || "Unassigned"}`
                              : inquiry.resource_name || "Unassigned"}
                          </small>
                          {inquiry.products?.length ? (
                            <div className="dashboard-inquiry-products">
                              {inquiry.products.map((product) => (
                                <div
                                  className="dashboard-inquiry-product"
                                  key={product.id || `${product.product_name}-${product.requirement}`}
                                >
                                  <span className="dashboard-inquiry-product-name">
                                    {product.product_name || product.product_type_name || "Product"}
                                  </span>
                                  <span>
                                    Qty {product.qty ?? product.quantity ?? 0}
                                  </span>
                                  {product.amount !== null && product.amount !== undefined && (
                                    <span>
                                      ₹{Number(product.amount).toLocaleString("en-IN")}
                                    </span>
                                  )}
                                  {product.requirement && (
                                    <span className="dashboard-inquiry-requirement">
                                      {product.requirement}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <small className="dashboard-inquiry-no-products">
                              No product details
                            </small>
                          )}
                        </div>
                        <span className="dashboard-inquiry-status">
                          {inquiry.is_not_started ? "Not started" : inquiry.status_name || "In progress"}
                        </span>
                        <span className="dashboard-inquiry-arrow">›</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="dashboard-inquiries-empty">
                    No inquiries are scheduled for this view.
                  </div>
                )}
              </section>

            </>
          )}
        </div>
      </main>

      {/* Floating Action Button - Only show on Dashboard (home page) */}
      {isDashboardPage && (
        <button
          className="fab-button"
          onClick={handleAddInquiry}
          aria-label="Add new inquiry"
        >
          <Icon name="plus" size={24} />
        </button>
      )}
    </div>
  );
}

export default Dashboard;
