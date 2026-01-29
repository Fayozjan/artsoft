// Вспомогательная функция для форматирования даты
export const formatDate = (dateString) => {
  if (!dateString) return "";

  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? "" : date.toLocaleDateString();
  } catch {
    return "";
  }
};

export function getAge(birthDate) {
  const today = new Date();
  const birth = new Date(birthDate);

  let age = today.getFullYear() - birth.getFullYear();

  const monthDiff = today.getMonth() - birth.getMonth();
  const dayDiff = today.getDate() - birth.getDate();

  // Если день рождения ещё не наступил в этом году — уменьшаем возраст
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--;
  }

  return age;
}
