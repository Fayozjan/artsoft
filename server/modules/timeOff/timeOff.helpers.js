export function buildTimeOffEmployeeAccess(user) {
  if (user.access_level === "absolute") {
    if (user.view_mode === "branch" && user.active_branch_id) {
      return {
        employee: {
          branch_id: user.active_branch_id,
        },
      };
    }
    return {};
  }

  if (user.access_level === "branch" && user.branch_access?.length) {
    if (user.view_mode === "branch" && user.active_branch_id) {
      return {
        employee: {
          branch_id: user.active_branch_id,
        },
      };
    }

    return {
      employee: {
        branch_id: { in: user.branch_access },
      },
    };
  }

  if (user.access_level === "department" && user.department_access?.length) {
    return {
      employee: {
        department_id: { in: user.department_access },
      },
    };
  }

  return { employee_id: -1 };
}
