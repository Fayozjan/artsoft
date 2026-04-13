export function buildBranchAccess(user) {
  if (user.access_level === "absolute") {
    return {};
  }

  if (user.access_level === "branch") {
    return {
      id: { in: user.branch_access || [] },
    };
  }

  if (user.access_level === "department") {
    return {
      departments: {
        some: {
          id: { in: user.department_access || [] },
        },
      },
    };
  }

  return {};
}
