export const createStaffMode = () => ({
  active: "Add Staff",
  selectedStaff: null,
});

export const editStaffMode = (staff) => ({
  active: "Add Staff",
  selectedStaff: staff,
});
