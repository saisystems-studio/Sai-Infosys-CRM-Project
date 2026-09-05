const normalizeRole = (role = "") =>
  String(role).trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");

export const ACTIVE_MENU_STORAGE_KEY = "crm_active_menu";

export function loadActiveMenu(storage) {
  try {
    return storage?.getItem(ACTIVE_MENU_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export function saveActiveMenu(menuName, storage) {
  if (!menuName) return;
  try {
    storage?.setItem(ACTIVE_MENU_STORAGE_KEY, menuName);
  } catch {
    // Navigation still works when browser storage is unavailable.
  }
}

export function hasFullMenuAccess(user = {}) {
  const role = normalizeRole(user.role);
  if (role === "admin" || role === "super admin") return true;
  if (user.staff_id != null) return false;
  return user.is_superuser === true;
}

export function buildMenuAccess(menus = []) {
  return Object.fromEntries(
    menus.map((menu) => [menu.Menu_Name, {
      view: menu.Can_View === true,
      add: menu.Can_Add === true,
      edit: menu.Can_Edit === true,
      delete: menu.Can_Delete === true,
    }]),
  );
}

export function canPerform(access, menuName, action) {
  return access[menuName]?.[action] === true;
}

export function selectInitialMenu(menus = [], currentMenu = "", hasDetailContext = false) {
  const refreshFallbacks = {
    "Schedule Detail": "Schedule",
    "Completed Inquiry Detail": "Completed Inquery Report",
  };

  const restoredMenu = refreshFallbacks[currentMenu] || currentMenu;

  if (menus.some((menu) => menu.Menu_Name === restoredMenu)) {
    return hasDetailContext && refreshFallbacks[currentMenu] ? currentMenu : restoredMenu;
  }

  if (menus.some((menu) => menu.Menu_Name === "Dashboard")) {
    return "Dashboard";
  }

  if (menus.some((menu) => menu.Menu_Name === "Overview")) {
    return "Overview";
  }

  const firstLeaf = menus.find((menu) => menu.parent_id != null);
  return firstLeaf?.Menu_Name || menus[0]?.Menu_Name || "";
}
