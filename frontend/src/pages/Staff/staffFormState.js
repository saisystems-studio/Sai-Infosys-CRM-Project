const emptyPermission = () => ({
  view: false,
  add: false,
  edit: false,
  delete: false,
});

export const mergeMenuPermissions = (menus, permissions = []) => {
  const merged = Object.fromEntries(
    menus.map((menu) => [menu.Id, emptyPermission()]),
  );

  permissions.forEach((permission) => {
    merged[permission.Menu] = {
      view: permission.Can_View,
      add: permission.Can_Add,
      edit: permission.Can_Edit,
      delete: permission.Can_Delete,
    };
  });

  return merged;
};
