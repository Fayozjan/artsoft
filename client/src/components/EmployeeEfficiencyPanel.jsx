import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
  AlarmClock,
  CalendarCheck2,
  ListChecks,
  Timer,
  TrendingDown,
  TrendingUp,
  Minus,
  X,
} from "lucide-react";

import Loading from "./Loading";
import {
  GRADE_COLORS,
  gradeColor,
  scoreColor,
} from "../utils/efficiencyGrades";
import styles from "./EmployeeEfficiencyPanel.module.scss";

// Зеркало COMPONENT_WEIGHTS с бэкенда — нужно справке, когда расчёт не пришёл
// (ошибка запроса). При наличии ответа веса берутся из него.
const BASE_WEIGHTS = {
  attendance: 30,
  punctuality: 25,
  workload: 25,
  tasks: 20,
};

// Пороги оценок — те же, что у gradeFor на бэкенде
const GRADE_SCALE = [
  { grade: "excellent", min: 90 },
  { grade: "good", min: 75 },
  { grade: "normal", min: 60 },
  { grade: "below", min: 40 },
  { grade: "low", min: 0 },
];

const COMPONENT_ICONS = {
  attendance: CalendarCheck2,
  punctuality: AlarmClock,
  workload: Timer,
  tasks: ListChecks,
};

const COMPONENT_LABEL_KEYS = {
  attendance: "effAttendance",
  punctuality: "effPunctuality",
  workload: "effWorkload",
  tasks: "effTasks",
};

const COMPONENT_HINT_KEYS = {
  attendance: "effAttendanceHint",
  punctuality: "effPunctualityHint",
  workload: "effWorkloadHint",
  tasks: "effTasksHint",
};

const COMPONENT_FORMULA_KEYS = {
  attendance: "effHelpAttendanceFormula",
  punctuality: "effHelpPunctualityFormula",
  workload: "effHelpWorkloadFormula",
  tasks: "effHelpTasksFormula",
};

const PERIOD_OPTIONS = [1, 3, 6, 12];

const RING_SIZE = 132;
const RING_STROKE = 11;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

// 610 → "10 ч 10 мин"; часы опускаются, пока их нет
const fmtMinutes = (minutes, t) => {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} ${t("minutesShort")}`;
  return `${h} ${t("hoursShort")} ${m} ${t("minutesShort")}`;
};

const fmtMonth = (monthKey, locale) => {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(locale || "ru-RU", {
    month: "short",
    year: "2-digit",
  });
};

// ── Кольцо общей оценки ──────────────────────────────────────────────────────

const ScoreRing = ({ score, color, label }) => (
  <div className={styles.ringWrap}>
    <svg width={RING_SIZE} height={RING_SIZE} className={styles.ring}>
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        strokeWidth={RING_STROKE}
        className={styles.ringTrack}
      />
      <circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RING_RADIUS}
        fill="none"
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
        stroke={color}
        strokeDasharray={RING_CIRC}
        strokeDashoffset={RING_CIRC * (1 - Math.min(100, score) / 100)}
        transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        className={styles.ringValue}
      />
    </svg>
    <div className={styles.ringCenter}>
      <span className={styles.ringScore} style={{ color }}>
        {Math.round(score)}
      </span>
      <span className={styles.ringLabel}>{label}</span>
    </div>
  </div>
);

// ── Строка составляющей ──────────────────────────────────────────────────────

const ComponentRow = ({ component, t }) => {
  const Icon = COMPONENT_ICONS[component.key];
  const color = component.applicable
    ? scoreColor(component.score)
    : "var(--text-secondary)";

  return (
    <div className={styles.compRow}>
      <div className={styles.compHead}>
        <span className={styles.compIcon} style={{ background: color + "18" }}>
          <Icon size={14} color={color} strokeWidth={2.2} />
        </span>
        <div className={styles.compTitleWrap}>
          <span className={styles.compTitle}>
            {t(COMPONENT_LABEL_KEYS[component.key])}
          </span>
          <span className={styles.compHint}>
            {t(COMPONENT_HINT_KEYS[component.key])}
          </span>
        </div>
        <div className={styles.compScoreWrap}>
          {component.applicable ? (
            <>
              <span className={styles.compScore} style={{ color }}>
                {component.score}
              </span>
              <span className={styles.compWeight}>
                {t("effWeightShort", {
                  weight: Math.round(component.effectiveWeight),
                })}
              </span>
            </>
          ) : (
            <span className={styles.compNoData}>{t("effNoData")}</span>
          )}
        </div>
      </div>

      <div className={styles.compTrack}>
        <div
          className={styles.compFill}
          style={{
            width: `${component.applicable ? Math.min(100, component.score) : 0}%`,
            background: color,
          }}
        />
      </div>
    </div>
  );
};

// ── Помесячная динамика ──────────────────────────────────────────────────────

const MonthlyChart = ({ monthly, t, locale }) => {
  const points = useMemo(
    () => monthly.filter((m) => m.score !== null),
    [monthly],
  );

  if (points.length < 2) return null;

  return (
    <div className={styles.monthlyCard}>
      <span className={styles.blockTitle}>{t("effMonthlyDynamics")}</span>
      <div className={styles.monthlyBars}>
        {points.map((p) => (
          <div key={p.month} className={styles.monthlyBarWrap}>
            <span className={styles.monthlyValue}>{Math.round(p.score)}</span>
            <div className={styles.monthlyTrack}>
              <div
                className={styles.monthlyFill}
                style={{
                  height: `${Math.max(4, Math.min(100, p.score))}%`,
                  background: scoreColor(p.score),
                }}
              />
            </div>
            <span className={styles.monthlyLabel}>
              {fmtMonth(p.month, locale)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Справка «как считается балл» ─────────────────────────────────────────────

// Портал в body: карточка профиля анимируется через transform, и position:
// fixed внутри неё считался бы от модалки, а не от вьюпорта
const HelpModal = ({ weights, onClose, t }) => {
  // Escape перехватывается на фазе capture: карточка профиля слушает то же
  // событие на document и иначе закрылась бы вместе со справкой
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.stopImmediatePropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return createPortal(
    <div
      className={styles.helpOverlay}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.helpCard} role="dialog" aria-modal="true">
        <header className={styles.helpHeader}>
          <h4 className={styles.helpTitle}>{t("effHelpTitle")}</h4>
          <button
            type="button"
            className={styles.helpClose}
            onClick={onClose}
            title={t("close")}
          >
            <X size={17} />
          </button>
        </header>

        <div className={styles.helpBody}>
          <p className={styles.helpIntro}>{t("effHelpIntro")}</p>

          <section className={styles.helpSection}>
            <span className={styles.helpSectionTitle}>
              {t("effHelpComponentsTitle")}
            </span>

            {Object.keys(BASE_WEIGHTS).map((key) => {
              const Icon = COMPONENT_ICONS[key];
              return (
                <div key={key} className={styles.helpItem}>
                  <div className={styles.helpItemHead}>
                    <Icon size={14} />
                    <span className={styles.helpItemTitle}>
                      {t(COMPONENT_LABEL_KEYS[key])}
                    </span>
                    <span className={styles.helpItemWeight}>
                      {t("effHelpWeight", { weight: weights[key] })}
                    </span>
                  </div>
                  <p className={styles.helpItemText}>
                    {t(COMPONENT_FORMULA_KEYS[key])}
                  </p>
                </div>
              );
            })}
          </section>

          <section className={styles.helpSection}>
            <span className={styles.helpSectionTitle}>
              {t("effHelpTotalTitle")}
            </span>
            <p className={styles.helpText}>{t("effHelpTotal")}</p>
            <p className={styles.helpText}>{t("effHelpRedistribute")}</p>
            <p className={styles.helpText}>{t("effHelpBonus")}</p>
          </section>

          <section className={styles.helpSection}>
            <span className={styles.helpSectionTitle}>
              {t("effHelpGradesTitle")}
            </span>
            <div className={styles.helpGrades}>
              {GRADE_SCALE.map((g, i) => {
                const upper = i === 0 ? 100 : GRADE_SCALE[i - 1].min - 1;
                return (
                  <div key={g.grade} className={styles.helpGradeRow}>
                    <span
                      className={styles.helpGradeDot}
                      style={{ background: GRADE_COLORS[g.grade] }}
                    />
                    <span className={styles.helpGradeName}>
                      {t(`effGrade_${g.grade}`)}
                    </span>
                    <span className={styles.helpGradeRange}>
                      {g.min}–{upper}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className={styles.helpSection}>
            <span className={styles.helpSectionTitle}>
              {t("effHelpSourcesTitle")}
            </span>
            <p className={styles.helpText}>{t("effHelpSources")}</p>
            <p className={styles.helpText}>{t("effHelpTolerance")}</p>
          </section>
        </div>
      </div>
    </div>,
    document.body,
  );
};

// ── Плитка сырого показателя ─────────────────────────────────────────────────

const MetricTile = ({ label, value, tone }) => (
  <div className={styles.metricTile}>
    <span className={styles.metricLabel}>{label}</span>
    <span
      className={styles.metricValue}
      style={tone ? { color: tone } : undefined}
    >
      {value}
    </span>
  </div>
);

// ── Панель ───────────────────────────────────────────────────────────────────

const EmployeeEfficiencyPanel = ({
  data,
  loading,
  months,
  onMonthsChange,
  error,
}) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "en" ? "en-US" : "ru-RU";
  const [helpOpen, setHelpOpen] = useState(false);

  // Веса берём из ответа — справка не должна расходиться с расчётом
  const weights = useMemo(() => {
    const fromData = {};
    (data?.components || []).forEach((c) => {
      fromData[c.key] = c.weight;
    });
    return { ...BASE_WEIGHTS, ...fromData };
  }, [data]);

  const periodSelect = (
    <div className={styles.periodSwitch}>
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt}
          type="button"
          className={`${styles.periodBtn} ${
            months === opt ? styles.periodBtnActive : ""
          }`}
          onClick={() => onMonthsChange(opt)}
        >
          {t("effMonthsShort", { months: opt })}
        </button>
      ))}
    </div>
  );

  // Шапка с переключателем периода остаётся на месте и во время загрузки —
  // иначе кнопки прыгают при каждой смене глубины расчёта
  const header = (
    <div className={styles.panelHeader}>
      <div className={styles.titleRow}>
        <span className={styles.blockTitle}>{t("effTitle")}</span>
        <button
          type="button"
          className={styles.helpBtn}
          onClick={() => setHelpOpen(true)}
          title={t("effHelpTitle")}
          aria-label={t("effHelpTitle")}
        >
          ?
        </button>
      </div>
      {periodSelect}
    </div>
  );

  const helpModal = helpOpen ? (
    <HelpModal weights={weights} onClose={() => setHelpOpen(false)} t={t} />
  ) : null;

  if (loading) {
    return (
      <div className={styles.panel}>
        {header}
        <div className={styles.loadingWrap}>
          <Loading />
        </div>
        {helpModal}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.panel}>
        {header}
        <div className={styles.empty}>{t("effLoadError")}</div>
        {helpModal}
      </div>
    );
  }

  const color = gradeColor(data.grade);
  const metrics = data.metrics || {};
  const tasks =
    data.components.find((c) => c.key === "tasks")?.details || null;

  const trendIcon =
    !data.trend || data.trend.delta === 0 ? (
      <Minus size={13} />
    ) : data.trend.delta > 0 ? (
      <TrendingUp size={13} />
    ) : (
      <TrendingDown size={13} />
    );

  return (
    <div className={styles.panel}>
      {header}

      {!data.hasData ? (
        <div className={styles.empty}>{t("effNoDataPeriod")}</div>
      ) : (
        <>
          <div className={styles.summary}>
            <ScoreRing
              score={data.score}
              color={color}
              label={t("effScoreOf100")}
            />

            <div className={styles.summaryInfo}>
              <span className={styles.gradeChip} style={{ background: color + "1f", color }}>
                {t(`effGrade_${data.grade}`)}
              </span>

              {data.trend && (
                <span
                  className={`${styles.trend} ${
                    data.trend.delta >= 0 ? styles.trendUp : styles.trendDown
                  }`}
                >
                  {trendIcon}
                  {data.trend.delta > 0 ? "+" : ""}
                  {data.trend.delta} {t("effTrendVsPrevMonth")}
                </span>
              )}

              {data.bonus > 0 && (
                <span className={styles.bonus}>
                  {t("effOvertimeBonus", { bonus: data.bonus })}
                </span>
              )}

              <span className={styles.periodNote}>
                {t("effPeriodRange", {
                  from: data.period.from,
                  to: data.period.to,
                })}
              </span>
            </div>
          </div>

          <div className={styles.components}>
            {data.components.map((c) => (
              <ComponentRow key={c.key} component={c} t={t} />
            ))}
          </div>

          <MonthlyChart monthly={data.monthly} t={t} locale={locale} />

          <div className={styles.metricsBlock}>
            <span className={styles.blockTitle}>{t("effRawMetrics")}</span>
            <div className={styles.metricsGrid}>
              <MetricTile
                label={t("effScheduledDays")}
                value={metrics.scheduledDays ?? 0}
              />
              <MetricTile
                label={t("effWorkedDays")}
                value={metrics.workedDays ?? 0}
              />
              <MetricTile
                label={t("effAbsentDays")}
                value={Math.max(
                  0,
                  (metrics.scheduledDays ?? 0) - (metrics.workedDays ?? 0),
                )}
                tone={
                  (metrics.scheduledDays ?? 0) - (metrics.workedDays ?? 0) > 0
                    ? GRADE_COLORS.low
                    : undefined
                }
              />
              <MetricTile
                label={t("effPaidTimeOffDays")}
                value={metrics.paidTimeOffDays ?? 0}
              />
              <MetricTile
                label={t("effLateDays")}
                value={metrics.lateDays ?? 0}
                tone={metrics.lateDays > 0 ? GRADE_COLORS.below : undefined}
              />
              <MetricTile
                label={t("effLateTotal")}
                value={fmtMinutes(metrics.lateMinutes, t)}
              />
              <MetricTile
                label={t("effEarlyLeaveDays")}
                value={metrics.earlyLeaveDays ?? 0}
              />
              <MetricTile
                label={t("effNormHours")}
                value={fmtMinutes(metrics.scheduledMinutes, t)}
              />
              <MetricTile
                label={t("effWorkedHours")}
                value={fmtMinutes(metrics.workedMinutes, t)}
              />
              <MetricTile
                label={t("effOvertime")}
                value={fmtMinutes(metrics.overtimeMinutes, t)}
                tone={
                  metrics.overtimeMinutes > 0
                    ? GRADE_COLORS.excellent
                    : undefined
                }
              />
              {tasks?.total > 0 && (
                <>
                  <MetricTile
                    label={t("effTasksOnTime")}
                    value={`${tasks.onTime} / ${tasks.resolved + tasks.openOverdue}`}
                  />
                  <MetricTile
                    label={t("effTasksOverdue")}
                    value={tasks.overdueClosed + tasks.openOverdue}
                    tone={
                      tasks.overdueClosed + tasks.openOverdue > 0
                        ? GRADE_COLORS.low
                        : undefined
                    }
                  />
                </>
              )}
            </div>
          </div>

        </>
      )}

      {helpModal}
    </div>
  );
};

export default EmployeeEfficiencyPanel;
