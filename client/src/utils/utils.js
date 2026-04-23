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

export function getBirthdayInfo(birthDate) {
  if (!birthDate) return null;

  const today = new Date();
  const birth = new Date(birthDate);

  today.setHours(0, 0, 0, 0);

  let age = today.getFullYear() - birth.getFullYear();

  const monthDiff = today.getMonth() - birth.getMonth();
  const dayDiff = today.getDate() - birth.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--;
  }

  const nextBirthday = new Date(
    today.getFullYear(),
    birth.getMonth(),
    birth.getDate(),
  );

  nextBirthday.setHours(0, 0, 0, 0);

  if (nextBirthday < today) {
    nextBirthday.setFullYear(today.getFullYear() + 1);
  }

  const diffDays = Math.round((nextBirthday - today) / (1000 * 60 * 60 * 24));

  let status = "normal";

  if (diffDays === 0) status = "today";
  else if (diffDays <= 7) status = "soon";

  return {
    age,
    diffDays,
    status,
  };
}

export function getExpiryBadge(date) {
  if (!date) return null;

  const today = new Date();
  const target = new Date(date);

  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));

  if (diff < 0) {
    return {
      status: "expired",
      text: `, Просрочен ${Math.abs(diff)} дн.`,
    };
  }

  if (diff === 0) {
    return {
      status: "today",
      text: ", Истекает сегодня",
    };
  }

  if (diff <= 30) {
    return {
      status: "soon",
      text: `, Ост. ${diff} дн.`,
    };
  }

  return {
    status: "normal",
    text: "",
  };
}
