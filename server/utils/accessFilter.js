export function buildAccessWhere(user) {
  if (!user) throw new Error("Пользователь не найден");

  const { access_level, branch_access = [], department_access = [] } = user;

  if (access_level === "absolute") {
    return {};
  }

  if (access_level === "branch") {
    return {
      employee: {
        branch_id:
          branch_access.length > 0 ? { in: branch_access } : { in: [] },
      },
    };
  }

  if (access_level === "department") {
    return {
      employee: {
        department_id:
          department_access.length > 0 ? { in: department_access } : { in: [] },
      },
    };
  }

  throw new Error(`Неизвестный уровень доступа: ${access_level}`);
}
