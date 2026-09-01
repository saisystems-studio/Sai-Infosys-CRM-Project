const normalizeRole = (role = "") =>
  String(role).trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");

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

export function selectInitialMenu(menus = [], currentMenu = "") {
  if (menus.some((menu) => menu.Menu_Name === currentMenu)) return currentMenu;
  if (menus.some((menu) => menu.Menu_Name === "Overview")) return "Overview";
  const firstLeaf = menus.find((menu) => menu.parent_id != null);
  return firstLeaf?.Menu_Name || menus[0]?.Menu_Name || "";
}
