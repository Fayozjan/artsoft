// «Кто добавил»: ФИО сотрудника логина (Фамилия Имя Отчество); у логина без сотрудника — сам логин.
export const userDisplayName = (user) => {
  if (!user) return "";
  const fullName = [user.employee?.last_name, user.employee?.first_name, user.employee?.middle_name]
    .filter(Boolean)
    .join(" ");
  return fullName || user.username || "";
};
