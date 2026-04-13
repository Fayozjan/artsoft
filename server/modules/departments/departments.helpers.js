export function buildDepartmentAccess(user) {
  // 1. Уровень "Absolute" (Полный доступ)
  if (user.access_level === "absolute") {
    // Если включен режим просмотра конкретного филиала
    if (user.view_mode === "branch" && user.active_branch_id) {
      return { branch_id: user.active_branch_id };
    }
    return {};
  }

  // 2. Уровень "Branch" (Доступ к списку филиалов)
  if (user.access_level === "branch") {
    // Если выбран конкретный филиал из разрешенных
    if (user.view_mode === "branch" && user.active_branch_id) {
      return { branch_id: user.active_branch_id };
    }
    // Иначе возвращаем все доступные филиалы
    return {
      branch_id: { in: user.branch_access || [] },
    };
  }

  // 3. Уровень "Department" (Доступ только к конкретным отделам)
  if (user.access_level === "department") {
    return {
      id: { in: user.department_access || [] },
    };
  }

  // По умолчанию запрещаем доступ (возвращаем невыполнимое условие),
  // если структура прав не подошла ни под один шаблон
  return { id: -1 };
}
