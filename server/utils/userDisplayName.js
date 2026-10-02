// Prisma select логина для вывода «кто добавил»: сам логин + ФИО привязанного сотрудника.
export const userNameSelect = {
  id: true,
  username: true,
  employee_id: true,
  employee: {
    select: {
      last_name: true,
      first_name: true,
      middle_name: true,
      photo: true,
      branch: { select: { name: true } },
      department: { select: { name: true } },
      position: { select: { name: true } },
    },
  },
};

// ФИО сотрудника логина (Фамилия Имя Отчество); у логина без сотрудника — сам логин.
export const userDisplayName = (user) => {
  if (!user) return null;
  const fullName = [user.employee?.last_name, user.employee?.first_name, user.employee?.middle_name]
    .filter(Boolean)
    .join(" ");
  return fullName || user.username || null;
};
