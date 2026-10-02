// Приказ на увольнение сохраняется без филиала (branch_id = null),
// поэтому для таких приказов берём филиал сотрудника.
// AND-обёртка нужна, чтобы не конфликтовать с where.OR поиска в getAll.
const branchScope = (branchId) => ({
  AND: [
    {
      OR: [
        { branch_id: branchId },
        { branch_id: null, employee: { branch_id: branchId } },
      ],
    },
  ],
});

export function buildEmploymentOrderAccess(user) {
  const activeBranchId =
    user.view_mode === "branch" && user.active_branch_id
      ? user.active_branch_id
      : null;

  if (user.access_level === "absolute") {
    return activeBranchId ? branchScope(activeBranchId) : {};
  }
  if (user.access_level === "branch" && user.branch_access?.length) {
    if (activeBranchId && user.branch_access.includes(activeBranchId)) {
      return branchScope(activeBranchId);
    }
    return { branch_id: { in: user.branch_access } };
  }
  if (user.access_level === "department" && user.department_access?.length) {
    return { department_id: { in: user.department_access } };
  }
  // если нет доступа — пустой результат
  return { id: -1 };
}
