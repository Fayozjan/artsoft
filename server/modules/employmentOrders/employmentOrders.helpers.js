export function buildEmploymentOrderAccess(user) {
  if (user.access_level === "absolute") return {};
  if (user.access_level === "branch" && user.branch_access?.length) {
    return { branch_id: { in: user.branch_access } };
  }
  if (user.access_level === "department" && user.department_access?.length) {
    return { department_id: { in: user.department_access } };
  }
  // если нет доступа — пустой результат
  return { id: -1 };
}
