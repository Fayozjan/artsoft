// Цвета оценки эффективности. Отдельный модуль, чтобы карточка профиля могла
// красить KPI, не импортируя саму панель (иначе ломается fast refresh).

export const GRADE_COLORS = {
  excellent: "#10b981",
  good: "#22c55e",
  normal: "#f59e0b",
  below: "#f97316",
  low: "#ef4444",
};

// Пастельный набор — для KPI поверх градиентной шапки профиля,
// где насыщенные цвета теряют контраст
export const GRADE_HERO_COLORS = {
  excellent: "#a7f3d0",
  good: "#bbf7d0",
  normal: "#fde68a",
  below: "#fed7aa",
  low: "#fecaca",
};

export const gradeColor = (grade) => GRADE_COLORS[grade] || GRADE_COLORS.low;

export const gradeHeroColor = (grade) =>
  GRADE_HERO_COLORS[grade] || GRADE_HERO_COLORS.low;

// Пороги те же, что у общей оценки на бэкенде (gradeFor)
export const scoreColor = (score) => {
  if (score >= 90) return GRADE_COLORS.excellent;
  if (score >= 75) return GRADE_COLORS.good;
  if (score >= 60) return GRADE_COLORS.normal;
  if (score >= 40) return GRADE_COLORS.below;
  return GRADE_COLORS.low;
};
