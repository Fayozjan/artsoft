// Расчёт коэффициента эффективности сотрудника.
//
// Модель: 4 взвешенные составляющие (0..100 баллов каждая) + небольшой бонус
// за переработки. Составляющая, по которой нет данных (нет графика, нет задач),
// объявляется неприменимой — её вес пропорционально перераспределяется между
// остальными, чтобы отсутствие данных не занижало итог.

export const COMPONENT_WEIGHTS = {
  attendance: 30, // присутствие: отработанные дни к плановым
  punctuality: 25, // пунктуальность: частота и глубина опозданий
  workload: 25, // выработка: отработанные минуты к норме
  tasks: 20, // задачи: закрытые в срок
};

export const COMPONENT_KEYS = Object.keys(COMPONENT_WEIGHTS);

// Штрафные шкалы пунктуальности: частота опозданий забирает до 60 баллов,
// средняя глубина (минут опоздания на отработанный день) — до 40
const LATE_FREQUENCY_PENALTY = 60;
const LATE_DEPTH_PENALTY_CAP = 40;
const LATE_MINUTE_WEIGHT = 2;

// Переработки не входят в взвешенный балл — идут отдельным бонусом сверху
export const OVERTIME_BONUS_CAP = 5;

const GRADE_THRESHOLDS = [
  { min: 90, grade: "excellent" },
  { min: 75, grade: "good" },
  { min: 60, grade: "normal" },
  { min: 40, grade: "below" },
  { min: 0, grade: "low" },
];

export const clamp = (v, min = 0, max = 100) =>
  Math.min(max, Math.max(min, Number.isFinite(v) ? v : 0));

export const round1 = (v) => Math.round((Number(v) || 0) * 10) / 10;

// "HH:MM" → минуты. Часы могут быть больше 24 (сумма за месяц), поэтому
// без ограничения диапазона.
export const hhmmToMinutes = (str) => {
  if (!str || typeof str !== "string") return 0;
  const [h, m] = str.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
};

// Присутствие. Оплачиваемые отсутствия (отпуск, отгул за счёт компании) уже
// засчитаны табелем в workedDays и входят в scheduledDays — они взаимно
// сокращаются и оценку не снижают.
export function scoreAttendance({ scheduledDays, workedDays }) {
  if (scheduledDays <= 0) {
    return { applicable: false, score: 0 };
  }
  return {
    applicable: true,
    score: round1(clamp((workedDays / scheduledDays) * 100)),
  };
}

// Пунктуальность. Знаменатель — дни с реальными проходами (в отпуске опоздать
// нельзя): у сотрудника, который был на месте 3 дня и опоздал дважды,
// дисциплина хуже, чем у отработавшего 22 дня с теми же двумя опозданиями.
export function scorePunctuality({ attendedDays, lateDays, lateMinutes }) {
  if (attendedDays <= 0) {
    return { applicable: false, score: 0 };
  }

  const frequencyPenalty = (lateDays / attendedDays) * LATE_FREQUENCY_PENALTY;
  const depthPenalty = Math.min(
    LATE_DEPTH_PENALTY_CAP,
    (lateMinutes / attendedDays) * LATE_MINUTE_WEIGHT,
  );

  return {
    applicable: true,
    score: round1(clamp(100 - frequencyPenalty - depthPenalty)),
  };
}

// Выработка нормы. workedMinutes приходит из табеля и уже включает
// оплачиваемые отсутствия — иначе отпуск обнулял бы показатель.
export function scoreWorkload({ workedMinutes, scheduledMinutes }) {
  if (scheduledMinutes <= 0) {
    return { applicable: false, score: 0 };
  }
  return {
    applicable: true,
    score: round1(clamp((workedMinutes / scheduledMinutes) * 100)),
  };
}

// Задачи. В знаменателе — закрытые задачи плюс просроченные незакрытые;
// задачи в работе с ещё не наступившим дедлайном не учитываются.
export function scoreTasks({ resolved, onTime, openOverdue }) {
  const total = resolved + openOverdue;
  if (total <= 0) {
    return { applicable: false, score: 0 };
  }
  return { applicable: true, score: round1(clamp((onTime / total) * 100)) };
}

// Бонус за переработки: 1 балл за каждый процент сверх нормы, но не больше
// OVERTIME_BONUS_CAP — чтобы переработки не перекрывали дисциплину.
// Начисляется только при выполненной норме: задержки после смены у того, кто
// отработал половину месяца, переработкой не являются.
export function overtimeBonus({
  overtimeMinutes,
  scheduledMinutes,
  workedMinutes,
}) {
  if (scheduledMinutes <= 0 || overtimeMinutes <= 0) return 0;
  if (workedMinutes < scheduledMinutes) return 0;

  return round1(
    Math.min(OVERTIME_BONUS_CAP, (overtimeMinutes / scheduledMinutes) * 100),
  );
}

// Взвешенная свёртка. Вес неприменимых составляющих распределяется между
// применимыми пропорционально их собственным весам.
export function weightedScore(components) {
  const applicable = components.filter((c) => c.applicable);
  const totalWeight = applicable.reduce((s, c) => s + c.weight, 0);

  if (totalWeight <= 0) return { score: 0, hasData: false };

  const score = applicable.reduce(
    (s, c) => s + (c.score * c.weight) / totalWeight,
    0,
  );

  return { score: round1(score), hasData: true };
}

export function gradeFor(score) {
  return GRADE_THRESHOLDS.find((g) => score >= g.min)?.grade || "low";
}

// Эффективный вес составляющей после перераспределения — фронт показывает
// его в подписи, чтобы вклад показателя был честным
export function effectiveWeights(components) {
  const totalWeight = components
    .filter((c) => c.applicable)
    .reduce((s, c) => s + c.weight, 0);

  return components.map((c) => ({
    ...c,
    effectiveWeight:
      c.applicable && totalWeight > 0
        ? round1((c.weight / totalWeight) * 100)
        : 0,
  }));
}
