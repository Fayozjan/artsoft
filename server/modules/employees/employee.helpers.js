export const parseDateOnly = (str) => {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

export function removeUndefined(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined),
  );
}

export function buildEmployeeAccess(user) {
  if (user.access_level === "absolute") {
    if (user.view_mode === "branch" && user.active_branch_id) {
      return { branch_id: user.active_branch_id };
    }
    return {};
  }
  if (user.access_level === "branch" && user.branch_access?.length) {
    if (user.view_mode === "branch" && user.active_branch_id) {
      return { branch_id: user.active_branch_id };
    }
    return { branch_id: { in: user.branch_access } };
  }
  if (user.access_level === "department" && user.department_access?.length) {
    return { department_id: { in: user.department_access } };
  }
  return { id: -1 };
}
