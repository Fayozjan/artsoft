import { Fragment, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  X,
  Pencil,
  User,
  Wallet,
  CalendarClock,
  Banknote,
  Package,
  FileText,
  Palmtree,
  Phone,
  Mail,
  Cake,
  IdCard,
  Briefcase,
  ShieldCheck,
  Clock,
  Gauge,
  TrendingUp,
  TrendingDown,
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  Download,
} from "lucide-react";

import Loading from "./Loading";
import EmployeeEfficiencyPanel from "./EmployeeEfficiencyPanel";
import { gradeHeroColor } from "../utils/efficiencyGrades";
import { EmployeeService, EmployeeEfficiencyService } from "../api";
import { useImagePreviewStore } from "../stores/imagePreviewStore";
import { useHideBranch } from "../hooks/useHideBranch";
import { formatWorkScheduleTime } from "../utils/workSchedule";
import { getAge } from "../utils/utils";
import { downloadEmployeeProfilePdf } from "../utils/employeeProfilePdf";
import { useAlertStore } from "../stores/alertStore";
import SortArrow from "./SortArrow";

import styles from "./EmployeeProfile.module.scss";

// 1234567 => "1 234 567" (неразрывные пробелы, чтобы сумма не рвалась переносом)
const fmt = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";

const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const ORDER_LABEL_KEYS = {
  hire: "hiredEvent",
  transfer: "transferEvent",
  leave: "leaveEvent",
  terminate: "terminateEvent",
};

const EDUCATION_KEYS = {
  higher: "higherEdu",
  secondary: "secondaryEdu",
  general: "generalEdu",
};

const SALARY_TYPE_KEYS = {
  monthly: "salaryTypeMonthly",
  hourly: "salaryTypeHourly",
  piecework: "salaryTypePiecework",
};

// Стаж от даты найма: "3 г. 4 мес."
const tenureFrom = (dateStr, t) => {
  if (!dateStr) return "—";
  const from = new Date(dateStr);
  const now = new Date();
  let months =
    (now.getFullYear() - from.getFullYear()) * 12 +
    (now.getMonth() - from.getMonth());
  if (now.getDate() < from.getDate()) months--;
  if (months < 0) return "—";
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y > 0 ? `${y} ${t("tenureYearsShort")}` : null, `${m} ${t("tenureMonthsShort")}`]
    .filter(Boolean)
    .join(" ");
};

// ── мелкие переиспользуемые куски ────────────────────────────────────────────

const Field = ({ label, value }) => (
  <div className={styles.field}>
    <span className={styles.fieldLabel}>{label}</span>
    <span className={styles.fieldValue}>
      {value === null || value === undefined || value === "" ? "—" : value}
    </span>
  </div>
);

const Card = ({ title, icon: Icon, action, children, className = "" }) => (
  <section className={`${styles.card} ${className}`}>
    {title && (
      <header className={styles.cardHeader}>
        {Icon && <Icon size={15} />}
        <h4>{title}</h4>
        {action && <div className={styles.cardHeaderAction}>{action}</div>}
      </header>
    )}
    <div className={styles.cardBody}>{children}</div>
  </section>
);

const Empty = ({ text }) => <div className={styles.empty}>{text}</div>;

const CURRENT_YEAR = new Date().getFullYear();

// Глубина расчёта эффективности по умолчанию — 3 календарных месяца
const DEFAULT_EFFICIENCY_MONTHS = 3;

// Цвет чипа по типу отсутствия: значения совпадают с time_off.type
const TIME_OFF_TONES = { hour: "blue", day_off: "purple", vacation: "green" };

// solid — непрозрачный вариант для градиентной шапки, где полупрозрачные
// фоны темы сливаются с подложкой
const Chip = ({ tone = "gray", solid, children }) => (
  <span
    className={`${styles.chip} ${
      solid ? styles[`chipSolid_${tone}`] : styles[`chip_${tone}`]
    }`}
  >
    {children}
  </span>
);

// Столбиковый график изменения зарплаты — только когда точек больше одной
const SalaryChart = ({ history, t }) => {
  const points = useMemo(
    () =>
      [...history]
        .filter((h) => h.amount > 0)
        .sort((a, b) => new Date(a.date_from) - new Date(b.date_from)),
    [history],
  );

  if (points.length < 2) return null;

  const max = Math.max(...points.map((p) => p.amount));
  const first = points[0].amount;
  const last = points[points.length - 1].amount;
  const growth = first > 0 ? ((last - first) / first) * 100 : 0;

  return (
    <div className={styles.chartCard}>
      <div className={styles.chartHead}>
        <span className={styles.chartTitle}>{t("salaryDynamics")}</span>
        <span
          className={`${styles.chartGrowth} ${growth >= 0 ? styles.up : styles.down}`}
        >
          {growth >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {growth >= 0 ? "+" : ""}
          {growth.toFixed(1)}%
        </span>
      </div>
      <div className={styles.chartBars}>
        {points.map((p) => (
          <div key={p.id} className={styles.chartBarWrap} title={fmt(p.amount)}>
            <span className={styles.chartBarValue}>{fmt(p.amount)}</span>
            <div
              className={styles.chartBar}
              style={{ height: `${Math.max(6, (p.amount / max) * 100)}%` }}
            />
            <span className={styles.chartBarLabel}>
              {new Date(p.date_from).toLocaleDateString("ru-RU", {
                month: "short",
                year: "2-digit",
              })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── главный компонент ────────────────────────────────────────────────────────

const EmployeeProfile = ({ employeeId, isOpen, onClose, onEdit, canEdit }) => {
  const { t } = useTranslation();
  const hideBranch = useHideBranch();
  const openImagePreview = useImagePreviewStore((s) => s.open);
  const showAlert = useAlertStore((s) => s.showAlert);

  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState("overview");
  const [expandedPayroll, setExpandedPayroll] = useState(null);
  const [financeYear, setFinanceYear] = useState(CURRENT_YEAR);
  const [financeSortField, setFinanceSortField] = useState(null);
  const [financeSortOrder, setFinanceSortOrder] = useState("asc");
  const [timeOffSortField, setTimeOffSortField] = useState(null);
  const [timeOffSortOrder, setTimeOffSortOrder] = useState("asc");
  const [portalContainer, setPortalContainer] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Эффективность грузится отдельным запросом: расчёт тяжелее профиля и
  // зависит от выбранной глубины периода
  const [efficiency, setEfficiency] = useState(null);
  const [efficiencyLoading, setEfficiencyLoading] = useState(false);
  const [efficiencyError, setEfficiencyError] = useState(false);
  const [efficiencyMonths, setEfficiencyMonths] = useState(
    DEFAULT_EFFICIENCY_MONTHS,
  );

  useEffect(() => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    setPortalContainer(container);
    return () => {
      if (document.body.contains(container)) document.body.removeChild(container);
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !employeeId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setProfile(null);
      setTab("overview");
      setFinanceYear(CURRENT_YEAR);
      setEfficiencyMonths(DEFAULT_EFFICIENCY_MONTHS);
      try {
        const res = await EmployeeService.getProfile(employeeId);
        if (!cancelled && res?.success) setProfile(res.data);
      } catch (e) {
        console.error("Ошибка загрузки профиля сотрудника", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, employeeId]);

  useEffect(() => {
    if (!isOpen || !employeeId) return;
    let cancelled = false;

    (async () => {
      setEfficiencyLoading(true);
      setEfficiencyError(false);
      // Сброс, иначе KPI шапки успевает показать оценку прошлого сотрудника
      setEfficiency(null);
      try {
        const res = await EmployeeEfficiencyService.get(employeeId, {
          months: efficiencyMonths,
        });
        if (!cancelled && res?.success) setEfficiency(res.data);
      } catch (e) {
        console.error("Ошибка расчёта эффективности сотрудника", e);
        if (!cancelled) {
          setEfficiency(null);
          setEfficiencyError(true);
        }
      } finally {
        if (!cancelled) setEfficiencyLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, employeeId, efficiencyMonths]);

  // Esc закрывает карточку — как и клик по подложке
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const emp = profile?.employee;

  const hireDate = useMemo(() => {
    if (!profile) return null;
    const hires = profile.employmentOrders.filter((o) => o.type === "hire" && o.date);
    if (hires.length) {
      return hires.reduce((min, o) => (new Date(o.date) < new Date(min) ? o.date : min), hires[0].date);
    }
    return emp?.added_at || null;
  }, [profile, emp]);

  const fullName = emp
    ? [emp.last_name, emp.first_name, emp.middle_name].filter(Boolean).join(" ")
    : "";

  const initials = emp
    ? [emp.last_name, emp.first_name]
        .filter(Boolean)
        .map((n) => n[0]?.toUpperCase())
        .join("")
    : "";

  const photoUrl = emp?.photo ? `/api/employees/image/${emp.photo}` : null;

  // Годы, за которые есть начисления; текущий год всегда в списке, чтобы
  // селект не оказался пустым у сотрудника без ведомостей
  const financeYears = useMemo(() => {
    const years = new Set([CURRENT_YEAR]);
    (profile?.payrollItems || []).forEach((p) => p.year && years.add(p.year));
    return [...years].sort((a, b) => b - a);
  }, [profile]);

  const financeItems = useMemo(
    () => (profile?.payrollItems || []).filter((p) => p.year === financeYear),
    [profile, financeYear],
  );

  // Таблица показывает год целиком: месяцы без ведомости идут заглушками,
  // чтобы было видно пропуски, а не только закрытые месяцы
  const financeRows = useMemo(() => {
    const byMonth = new Map();
    financeItems.forEach((p) => p.month && byMonth.set(p.month, p));

    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      return (
        byMonth.get(month) || {
          id: `empty-${financeYear}-${month}`,
          month,
          year: financeYear,
          placeholder: true,
          paymentLogs: [],
        }
      );
    });
  }, [financeItems, financeYear]);

  // Итоги считаем по выбранному году, а не по всей истории (summary с бэка)
  const financeTotals = useMemo(
    () => ({
      accrued: financeItems.reduce((s, p) => s + p.net, 0),
      paid: financeItems.reduce((s, p) => s + p.paid_amount, 0),
      // Переносов между месяцами нет — остаток складывается по всем месяцам,
      // а не берётся с последней строки
      balance: financeItems.reduce(
        (s, p) =>
          s +
          Math.max(
            0,
            Number(p.net || 0) -
              Number(p.debt_deduction || 0) -
              Number(p.paid_amount || 0),
          ),
        0,
      ),
    }),
    [financeItems],
  );

  const handleFinanceSort = (field) => {
    if (financeSortField === field) {
      setFinanceSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setFinanceSortField(field);
      setFinanceSortOrder("asc");
    }
  };

  const sortedFinanceRows = useMemo(() => {
    if (!financeSortField) return financeRows;
    return [...financeRows].sort((a, b) => {
      const aVal = Number(a[financeSortField] ?? 0);
      const bVal = Number(b[financeSortField] ?? 0);
      return financeSortOrder === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [financeRows, financeSortField, financeSortOrder]);

  const handleTimeOffSort = (field) => {
    if (timeOffSortField === field) {
      setTimeOffSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setTimeOffSortField(field);
      setTimeOffSortOrder("asc");
    }
  };

  const sortedTimeOff = useMemo(() => {
    if (!timeOffSortField || !profile?.timeOff) return profile?.timeOff || [];
    return [...profile.timeOff].sort((a, b) => {
      let aVal = a[timeOffSortField];
      let bVal = b[timeOffSortField];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (timeOffSortField === "date_from") {
        return timeOffSortOrder === "asc"
          ? new Date(aVal) - new Date(bVal)
          : new Date(bVal) - new Date(aVal);
      }

      if (typeof aVal === "boolean" && typeof bVal === "boolean") {
        return timeOffSortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }

      return timeOffSortOrder === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }, [profile?.timeOff, timeOffSortField, timeOffSortOrder]);

  // Выгрузка карточки в PDF: собирает тот же набор данных, что и вкладки
  const handleDownloadPdf = async () => {
    if (!profile || pdfLoading) return;
    setPdfLoading(true);
    try {
      await downloadEmployeeProfilePdf({
        profile,
        efficiency,
        t,
        hideBranch,
        photoUrl,
      });
    } catch (e) {
      console.error("Ошибка выгрузки профиля в PDF", e);
      showAlert(t("errorOccurred"), "error");
    } finally {
      setPdfLoading(false);
    }
  };

  const TABS = useMemo(() => {
    if (!profile) return [];
    return [
      { key: "overview", label: t("profileOverview"), icon: User },
      { key: "efficiency", label: t("effTab"), icon: Gauge },
      { key: "orders", label: t("employmentOrdersHistory"), icon: FileText, count: profile.employmentOrders.length },
      { key: "timeOff", label: t("timeOffHistory"), icon: Palmtree, count: profile.timeOff.length },
      { key: "schedule", label: t("scheduleHistory"), icon: CalendarClock, count: profile.scheduleHistory.length },
      { key: "salary", label: t("salaryHistory"), icon: Wallet, count: profile.salaryHistory.length },
      { key: "finance", label: t("financeHistory"), icon: Banknote, count: financeItems.length },
      { key: "assets", label: t("assetsHistory"), icon: Package, count: profile.assetAssignments.length },
    ];
  }, [profile, financeItems, t]);

  if (!portalContainer) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
        >
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
          >
            <button className={styles.closeBtn} onClick={onClose} title={t("close")}>
              <X size={18} />
            </button>

            {loading && (
              <div className={styles.loadingWrap}>
                <Loading />
              </div>
            )}

            {!loading && !profile && (
              <div className={styles.loadingWrap}>
                <Empty text={t("noData")} />
              </div>
            )}

            {!loading && profile && (
              <>
                {/* ── Шапка ───────────────────────────────────────────── */}
                <header className={styles.hero}>
                  <div className={styles.heroGlow} />

                  <div className={styles.heroMain}>
                    <div
                      className={`${styles.avatar} ${emp.status === false ? styles.avatarInactive : ""}`}
                      onClick={() => photoUrl && openImagePreview(photoUrl)}
                      style={{ cursor: photoUrl ? "pointer" : "default" }}
                    >
                      {photoUrl ? (
                        <img src={photoUrl} alt={fullName} />
                      ) : (
                        <span className={styles.avatarInitials}>{initials}</span>
                      )}
                    </div>

                    <div className={styles.heroInfo}>
                      <div className={styles.heroNameRow}>
                        <h2 className={styles.heroName}>{fullName}</h2>
                        <span className={styles.heroId}>#{emp.id}</span>
                        <Chip solid tone={emp.status === false ? "red" : "green"}>
                          {emp.status === false ? t("terminated") : t("active")}
                        </Chip>
                      </div>

                      <div className={styles.heroSub}>
                        {[
                          emp.position?.name,
                          emp.department?.name,
                          hideBranch ? null : emp.branch?.name,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>

                      <div className={styles.heroMeta}>
                        {emp.phone && (
                          <a className={styles.heroMetaItem} href={`tel:${emp.phone}`}>
                            <Phone size={13} />
                            {emp.phone}
                          </a>
                        )}
                        {emp.email && (
                          <a className={styles.heroMetaItem} href={`mailto:${emp.email}`}>
                            <Mail size={13} />
                            {emp.email}
                          </a>
                        )}
                        {emp.date_of_birth && (
                          <span className={styles.heroMetaItem}>
                            <Cake size={13} />
                            {fmtDate(emp.date_of_birth)} · {getAge(emp.date_of_birth)}{" "}
                            {t("yearsOld")}
                          </span>
                        )}
                        {emp.employee_number && (
                          <span className={styles.heroMetaItem}>
                            <IdCard size={13} />
                            {emp.employee_number}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={styles.heroActions}>
                      <button
                        className={styles.pdfBtn}
                        onClick={handleDownloadPdf}
                        disabled={pdfLoading}
                        title={t("downloadProfile")}
                      >
                        <Download size={14} />
                        {pdfLoading ? `${t("downloadProfile")}…` : t("downloadProfile")}
                      </button>

                      {canEdit && onEdit && (
                        <button className={styles.editBtn} onClick={() => onEdit(emp.id)}>
                          <Pencil size={14} />
                          {t("edit")}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ── KPI-полоса ────────────────────────────────────── */}
                  <div className={styles.kpiRow}>
                    <div
                      className={`${styles.kpi} ${styles.kpiClickable}`}
                      onClick={() => setTab("efficiency")}
                      title={t("effTab")}
                    >
                      <span className={styles.kpiLabel}>{t("efficiency")}</span>
                      <span
                        className={styles.kpiValue}
                        style={
                          efficiency?.hasData
                            ? { color: gradeHeroColor(efficiency.grade) }
                            : undefined
                        }
                      >
                        {efficiencyLoading
                          ? "…"
                          : efficiency?.hasData
                            ? Math.round(efficiency.score)
                            : "—"}
                      </span>
                      <span className={styles.kpiSub}>
                        {efficiency?.hasData
                          ? t(`effGrade_${efficiency.grade}`)
                          : t("effNoData")}
                      </span>
                    </div>
                    <div className={styles.kpi}>
                      <span className={styles.kpiLabel}>{t("tenure")}</span>
                      <span className={styles.kpiValue}>{tenureFrom(hireDate, t)}</span>
                      <span className={styles.kpiSub}>{fmtDate(hireDate)}</span>
                    </div>
                    <div className={styles.kpi}>
                      <span className={styles.kpiLabel}>{t("currentSalary")}</span>
                      <span className={styles.kpiValue}>
                        {profile.summary.currentSalary
                          ? fmt(profile.summary.currentSalary.amount)
                          : "—"}
                      </span>
                      <span className={styles.kpiSub}>
                        {profile.summary.currentSalary
                          ? t(
                              SALARY_TYPE_KEYS[profile.summary.currentSalary.salary_type] ||
                                profile.summary.currentSalary.salary_type,
                            )
                          : t("noSalarySet")}
                      </span>
                    </div>
                    <div className={styles.kpi}>
                      <span className={styles.kpiLabel}>{t("workSchedule")}</span>
                      <span className={styles.kpiValue}>
                        {emp.workSchedule?.name || "—"}
                      </span>
                      <span className={styles.kpiSub}>
                        {emp.workSchedule
                          ? t(`scheduleType.${emp.workSchedule.type}`)
                          : t("noData")}
                      </span>
                    </div>
                    <div className={styles.kpi}>
                      <span className={styles.kpiLabel}>{t("assetsOnHand")}</span>
                      <span className={styles.kpiValue}>{profile.summary.assets.assigned}</span>
                      <span className={styles.kpiSub}>
                        {t("assetsReturnedShort")}: {profile.summary.assets.returned}
                      </span>
                    </div>
                    <div className={styles.kpi}>
                      <span className={styles.kpiLabel}>{t("salaryBalance")}</span>
                      <span
                        className={`${styles.kpiValue} ${
                          profile.summary.totals.balance < 0 ? styles.negative : styles.positive
                        }`}
                      >
                        {fmt(profile.summary.totals.balance)}
                      </span>
                    </div>
                  </div>
                </header>

                {/* ── Вкладки ─────────────────────────────────────────── */}
                <nav className={styles.tabs}>
                  {TABS.map((tb) => (
                    <button
                      key={tb.key}
                      className={`${styles.tab} ${tab === tb.key ? styles.tabActive : ""}`}
                      onClick={() => setTab(tb.key)}
                    >
                      <tb.icon size={15} />
                      <span>{tb.label}</span>
                      {tb.count > 0 && <span className={styles.tabCount}>{tb.count}</span>}
                    </button>
                  ))}
                </nav>

                {/* ── Содержимое ──────────────────────────────────────── */}
                <div className={styles.content}>
                  {tab === "overview" && (
                    <div className={styles.grid}>
                      <Card title={t("personalData")} icon={User}>
                        <Field label={t("fullName")} value={fullName} />
                        <Field
                          label={t("dateOfBirth")}
                          value={
                            emp.date_of_birth
                              ? `${fmtDate(emp.date_of_birth)} (${getAge(emp.date_of_birth)} ${t("yearsOld")})`
                              : "—"
                          }
                        />
                        <Field
                          label={t("gender")}
                          value={
                            emp.gender === "male"
                              ? t("male")
                              : emp.gender === "female"
                                ? t("female")
                                : t("notSpecified")
                          }
                        />
                        <Field
                          label={t("education")}
                          value={
                            emp.education
                              ? t(EDUCATION_KEYS[emp.education] || emp.education)
                              : null
                          }
                        />
                        <Field label={t("speciality")} value={emp.education_specialty} />
                      </Card>

                      <Card title={t("contactsTitle")} icon={Phone}>
                        <Field label={t("phone")} value={emp.phone} />
                        <Field label={t("email")} value={emp.email} />
                        <Field label={t("address")} value={emp.address} />
                      </Card>

                      <Card title={t("documentsTitle")} icon={IdCard}>
                        <Field label={t("pinfl")} value={emp.pinfl} />
                        <Field label={t("passport")} value={emp.passport} />
                        <Field
                          label={t("passportExpiry")}
                          value={fmtDate(emp.passport_expiry_date)}
                        />
                        <Field label={t("employeeNumber")} value={emp.employee_number} />
                      </Card>

                      <Card title={t("jobTitle")} icon={Briefcase}>
                        {!hideBranch && (
                          <Field label={t("branch")} value={emp.branch?.name} />
                        )}
                        <Field label={t("department")} value={emp.department?.name} />
                        <Field label={t("position")} value={emp.position?.name} />
                        <Field label={t("hireDate")} value={fmtDate(hireDate)} />
                        <Field label={t("tenure")} value={tenureFrom(hireDate, t)} />
                        <Field label={t("workSchedule")} value={emp.workSchedule?.name} />
                        {emp.workSchedule && (
                          <Field
                            label={t("workMode")}
                            value={
                              <span className={styles.scheduleMode}>
                                {formatWorkScheduleTime(emp.workSchedule)}
                              </span>
                            }
                          />
                        )}
                      </Card>

                      <Card title={t("accessTitle")} icon={ShieldCheck}>
                        <Field label={t("username")} value={emp.user?.username} />
                        <Field
                          label={t("accessLevelLabel")}
                          value={emp.user?.access_level ? t(`access_${emp.user.access_level}`) : null}
                        />
                        <Field label={t("telegramId")} value={emp.user?.telegram_id} />
                        <Field
                          label={t("doors")}
                          value={
                            emp.doors?.length
                              ? emp.doors.map((d) => d.name).join(", ")
                              : null
                          }
                        />
                      </Card>

                      <Card title={t("attendance")} icon={Clock}>
                        <Field
                          label={t("totalFacePassesLabel")}
                          value={profile.attendance.totalPasses}
                        />
                        <Field
                          label={t("firstPassLabel")}
                          value={fmtDateTime(profile.attendance.firstPassAt)}
                        />
                        <Field
                          label={t("lastPassLabel")}
                          value={fmtDateTime(profile.attendance.lastPassAt)}
                        />
                        <Field
                          label={t("passDirection")}
                          value={
                            profile.attendance.lastPassDirection ? (
                              <Chip
                                tone={
                                  profile.attendance.lastPassDirection === "in" ? "green" : "red"
                                }
                              >
                                {profile.attendance.lastPassDirection === "in"
                                  ? t("entry")
                                  : t("exit")}
                              </Chip>
                            ) : null
                          }
                        />
                        <Field label={t("door")} value={profile.attendance.lastPassDoor} />
                      </Card>
                    </div>
                  )}

                  {tab === "efficiency" && (
                    <EmployeeEfficiencyPanel
                      data={efficiency}
                      loading={efficiencyLoading}
                      error={efficiencyError}
                      months={efficiencyMonths}
                      onMonthsChange={setEfficiencyMonths}
                    />
                  )}

                  {tab === "salary" && (
                    <>
                      <SalaryChart history={profile.salaryHistory} t={t} />

                      {profile.salaryHistory.length === 0 ? (
                        <Empty text={t("salaryHistoryEmpty")} />
                      ) : (
                        <div className={styles.historyGrid}>
                          {profile.salaryHistory.map((item, i) => {
                            const prev = profile.salaryHistory[i + 1];
                            const diff = prev ? item.amount - prev.amount : 0;
                            const isCurrent = !item.date_to;

                            return (
                              <div
                                key={item.id}
                                className={`${styles.historyCard} ${isCurrent ? styles.historyCardActive : ""}`}
                              >
                                <div className={styles.tlCardHead}>
                                  <div className={styles.tlAmount}>
                                    {fmt(item.amount)}
                                    {diff !== 0 && (
                                      <span
                                        className={`${styles.tlDiff} ${diff > 0 ? styles.up : styles.down}`}
                                      >
                                        {diff > 0 ? (
                                          <ArrowUpRight size={13} />
                                        ) : (
                                          <ArrowDownRight size={13} />
                                        )}
                                        {diff > 0 ? "+" : "−"}
                                        {fmt(Math.abs(diff))}
                                      </span>
                                    )}
                                  </div>
                                  <Chip tone={isCurrent ? "green" : "gray"}>
                                    {t(SALARY_TYPE_KEYS[item.salary_type] || item.salary_type)}
                                  </Chip>
                                </div>

                                <div className={styles.tlPeriod}>
                                  {fmtDate(item.date_from)} —{" "}
                                  {item.date_to ? fmtDate(item.date_to) : t("presentToDate")}
                                </div>

                                {item.note && <div className={styles.tlNote}>{item.note}</div>}

                                <div className={styles.tlFoot}>
                                  {t("addedBy")}: {item.addedBy} · {fmtDateTime(item.added_at)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}

                  {tab === "schedule" && (
                    <>
                      {profile.scheduleHistory.length === 0 ? (
                        <Empty text={t("historyEmpty")} />
                      ) : (
                        <div className={styles.historyGrid}>
                          {profile.scheduleHistory.map((item) => {
                            const isCurrent = !item.date_to;
                            return (
                              <div
                                key={item.id}
                                className={`${styles.historyCard} ${isCurrent ? styles.historyCardActive : ""}`}
                              >
                                <div className={styles.tlCardHead}>
                                  <div className={styles.tlTitle}>
                                    {item.workSchedule?.name || "—"}
                                  </div>
                                  <Chip tone={isCurrent ? "green" : "gray"}>
                                    {t(`scheduleType.${item.workSchedule?.type}`)}
                                  </Chip>
                                </div>

                                <div className={styles.tlPeriod}>
                                  {fmtDate(item.date_from)} —{" "}
                                  {item.date_to ? fmtDate(item.date_to) : t("presentToDate")}
                                </div>

                                <div className={styles.scheduleMode}>
                                  {formatWorkScheduleTime(item.workSchedule)}
                                </div>

                                <div className={styles.tlFoot}>
                                  {t("addedBy")}: {item.addedBy} · {fmtDateTime(item.added_at)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}

                  {tab === "finance" && (
                    <>
                      <div className={styles.miniStats}>
                        <div className={styles.miniStat}>
                          <span>{t("statsTotalAccruedShort")}</span>
                          <strong>{fmt(financeTotals.accrued)}</strong>
                        </div>
                        <div className={styles.miniStat}>
                          <span>{t("paid")}</span>
                          <strong className={styles.positive}>
                            {fmt(financeTotals.paid)}
                          </strong>
                        </div>
                        <div className={styles.miniStat}>
                          <span>{t("salaryBalance")}</span>
                          <strong
                            className={
                              financeTotals.balance < 0
                                ? styles.negative
                                : styles.positive
                            }
                          >
                            {fmt(financeTotals.balance)}
                          </strong>
                        </div>
                      </div>

                      <Card
                        title={t("payroll")}
                        icon={Banknote}
                        className={styles.tableCard}
                        action={
                          <select
                            className={styles.yearSelect}
                            value={financeYear}
                            onChange={(e) => {
                              setFinanceYear(Number(e.target.value));
                              setExpandedPayroll(null);
                            }}
                          >
                            {financeYears.map((y) => (
                              <option key={y} value={y}>
                                {y}
                              </option>
                            ))}
                          </select>
                        }
                      >
                        <div className={styles.tableWrap}>
                          <table className={styles.table}>
                            <thead>
                              <tr>
                                <th onClick={() => handleFinanceSort("month")}>
                                  <span className={styles.headerContent}>
                                    {t("period")}
                                    <SortArrow active={financeSortField === "month"} order={financeSortOrder} />
                                  </span>
                                </th>
                                <th onClick={() => handleFinanceSort("base_salary")}>
                                  <span className={styles.headerContent}>
                                    {t("baseSalary")}
                                    <SortArrow active={financeSortField === "base_salary"} order={financeSortOrder} />
                                  </span>
                                </th>
                                <th>{t("workedLabel")}</th>
                                <th onClick={() => handleFinanceSort("accrued")}>
                                  <span className={styles.headerContent}>
                                    {t("accrued")}
                                    <SortArrow active={financeSortField === "accrued"} order={financeSortOrder} />
                                  </span>
                                </th>
                                <th onClick={() => handleFinanceSort("debt_deduction")}>
                                  <span className={styles.headerContent}>
                                    {t("debtDeduction")}
                                    <SortArrow active={financeSortField === "debt_deduction"} order={financeSortOrder} />
                                  </span>
                                </th>
                                <th onClick={() => handleFinanceSort("net")}>
                                  <span className={styles.headerContent}>
                                    {t("net")}
                                    <SortArrow active={financeSortField === "net"} order={financeSortOrder} />
                                  </span>
                                </th>
                                <th onClick={() => handleFinanceSort("paid_amount")}>
                                  <span className={styles.headerContent}>
                                    {t("paid")}
                                    <SortArrow active={financeSortField === "paid_amount"} order={financeSortOrder} />
                                  </span>
                                </th>
                                <th>{t("status")}</th>
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              {sortedFinanceRows.map((p) =>
                                p.placeholder ? (
                                  <tr key={p.id} className={styles.emptyRow}>
                                    <td className={styles.nowrap}>
                                      {t(`months.${p.month}`)} {p.year}
                                    </td>
                                    <td className={styles.num}>—</td>
                                    <td className={styles.nowrap}>—</td>
                                    <td className={styles.num}>—</td>
                                    <td className={styles.num}>—</td>
                                    <td className={styles.num}>—</td>
                                    <td className={styles.num}>—</td>
                                    <td>
                                      <Chip tone="gray">{t("noPayrollSheet")}</Chip>
                                    </td>
                                    <td />
                                  </tr>
                                ) : (
                                  <Fragment key={p.id}>
                                    <tr
                                      className={styles.clickableRow}
                                      onClick={() =>
                                        setExpandedPayroll(
                                          expandedPayroll === p.id ? null : p.id,
                                        )
                                      }
                                    >
                                      <td className={styles.nowrap}>
                                        {p.month ? t(`months.${p.month}`) : "—"} {p.year}
                                      </td>
                                      <td className={styles.num}>{fmt(p.base_salary)}</td>
                                      <td className={styles.nowrap}>
                                        {p.salary_type === "hourly"
                                          ? `${p.worked_hours || 0} / ${p.total_work_hours || 0}`
                                          : `${p.worked_days} / ${p.total_work_days}`}
                                      </td>
                                      <td className={styles.num}>{fmt(p.accrued)}</td>
                                      <td className={styles.num}>{fmt(p.debt_deduction)}</td>
                                      <td className={`${styles.num} ${styles.strong}`}>
                                        {fmt(p.net)}
                                      </td>
                                      <td className={styles.num}>{fmt(p.paid_amount)}</td>
                                      <td>
                                        <Chip
                                          tone={
                                            p.payout_status === "paid"
                                              ? "green"
                                              : p.payout_status === "partially_paid"
                                                ? "amber"
                                                : "gray"
                                          }
                                        >
                                          {/* нечего платить: месяц без начислений и выплат —
                                              "Не оплачено" тут вводит в заблуждение */}
                                          {p.accrued === 0 && p.net === 0 && p.paid_amount === 0
                                            ? t("payoutStatus.nothing")
                                            : t(`payoutStatus.${p.payout_status}`, p.payout_status)}
                                        </Chip>
                                      </td>
                                      <td>
                                        {p.paymentLogs.length > 0 && (
                                          <ChevronDown
                                            size={15}
                                            className={`${styles.chevron} ${
                                              expandedPayroll === p.id ? styles.chevronOpen : ""
                                            }`}
                                          />
                                        )}
                                      </td>
                                    </tr>

                                    {expandedPayroll === p.id && p.paymentLogs.length > 0 && (
                                      <tr className={styles.logsRow}>
                                        <td colSpan={10}>
                                          <div className={styles.logs}>
                                            <div className={styles.logsTitle}>
                                              {t("paymentsLabel")}
                                            </div>
                                            {p.paymentLogs.map((l) => (
                                              <div key={l.id} className={styles.logRow}>
                                                <span>{fmtDate(l.payment_date)}</span>
                                                <strong>{fmt(l.amount)}</strong>
                                                <span className={styles.logNote}>
                                                  {l.note || ""}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                ),
                              )}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    </>
                  )}

                  {tab === "assets" && (
                    <>
                      <div className={styles.miniStats}>
                        <div className={styles.miniStat}>
                          <span>{t("stateAssigned")}</span>
                          <strong>{profile.summary.assets.assigned}</strong>
                        </div>
                        <div className={styles.miniStat}>
                          <span>{t("stateReturned")}</span>
                          <strong>{profile.summary.assets.returned}</strong>
                        </div>
                        <div className={styles.miniStat}>
                          <span>{t("stateScrapped")}</span>
                          <strong>{profile.summary.assets.scrapped}</strong>
                        </div>
                      </div>

                      {profile.assetAssignments.length === 0 ? (
                        <Empty text={t("noData")} />
                      ) : (
                        <div className={styles.assetGrid}>
                          {profile.assetAssignments.map((a) => (
                            <div
                              key={a.id}
                              className={`${styles.assetCard} ${
                                a.state === "assigned" ? styles.assetActive : ""
                              }`}
                            >
                              <div className={styles.assetHead}>
                                <div className={styles.assetName}>
                                  <Package size={15} />
                                  {a.asset_name}
                                  {a.quantity > 1 && (
                                    <span className={styles.assetQty}>×{a.quantity}</span>
                                  )}
                                </div>
                                <Chip
                                  tone={
                                    a.state === "assigned"
                                      ? "blue"
                                      : a.state === "returned"
                                        ? "green"
                                        : "red"
                                  }
                                >
                                  {t(
                                    a.state === "assigned"
                                      ? "stateAssigned"
                                      : a.state === "returned"
                                        ? "stateReturned"
                                        : "stateScrapped",
                                  )}
                                </Chip>
                              </div>

                              {a.asset_spec && (
                                <div className={styles.assetSpec}>{a.asset_spec}</div>
                              )}

                              <div className={styles.assetFields}>
                                <Field label={t("assetCondition")} value={a.asset_condition} />
                                <Field label={t("assignedDate")} value={fmtDate(a.assigned_date)} />
                                {a.expected_return_date && (
                                  <Field
                                    label={t("expectedReturnDate")}
                                    value={fmtDate(a.expected_return_date)}
                                  />
                                )}
                                {a.return_date && (
                                  <Field label={t("returnDate")} value={fmtDate(a.return_date)} />
                                )}
                                {a.return_condition && (
                                  <Field
                                    label={t("returnCondition")}
                                    value={a.return_condition}
                                  />
                                )}
                                {Array.isArray(a.custom_fields) &&
                                  a.custom_fields.map((cf, idx) => (
                                    <Field key={idx} label={cf.label} value={cf.value} />
                                  ))}
                              </div>

                              {a.note && <div className={styles.tlNote}>{a.note}</div>}

                              <div className={styles.tlFoot}>
                                {t("addedBy")}: {a.addedBy}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {tab === "orders" && (
                    <>
                      {profile.employmentOrders.length === 0 ? (
                        <Empty text={t("noData")} />
                      ) : (
                        <div className={styles.timeline}>
                          {profile.employmentOrders.map((o, i) => (
                            <div key={o.id} className={styles.tlItem}>
                              <div
                                className={`${styles.tlDot} ${styles[`order_${o.type}`] || ""}`}
                              />
                              {i !== profile.employmentOrders.length - 1 && (
                                <div className={styles.tlLine} />
                              )}

                              <div className={styles.tlCard}>
                                <div className={styles.tlCardHead}>
                                  <div className={styles.tlTitle}>
                                    {ORDER_LABEL_KEYS[o.type] ? t(ORDER_LABEL_KEYS[o.type]) : o.type}
                                  </div>
                                  {o.order_number && (
                                    <Chip tone="gray">№ {o.order_number}</Chip>
                                  )}
                                </div>

                                <div className={styles.tlPeriod}>{fmtDate(o.date)}</div>

                                <div className={styles.orderFields}>
                                  {!hideBranch && (
                                    <Field label={t("branch")} value={o.branch?.name} />
                                  )}
                                  <Field label={t("department")} value={o.department?.name} />
                                  <Field label={t("position")} value={o.position?.name} />
                                </div>

                                {o.note && <div className={styles.tlNote}>{o.note}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {tab === "timeOff" && (
                    <>
                      {profile.timeOff.length === 0 ? (
                        <Empty text={t("noData")} />
                      ) : (
                        <div className={styles.tableWrap}>
                          <table className={styles.table}>
                            <thead>
                              <tr>
                                <th onClick={() => handleTimeOffSort("date_from")}>
                                  <span className={styles.headerContent}>
                                    {t("period")}
                                    <SortArrow active={timeOffSortField === "date_from"} order={timeOffSortOrder} />
                                  </span>
                                </th>
                                <th onClick={() => handleTimeOffSort("type")}>
                                  <span className={styles.headerContent}>
                                    {t("type")}
                                    <SortArrow active={timeOffSortField === "type"} order={timeOffSortOrder} />
                                  </span>
                                </th>
                                <th onClick={() => handleTimeOffSort("reason")}>
                                  <span className={styles.headerContent}>
                                    {t("reason")}
                                    <SortArrow active={timeOffSortField === "reason"} order={timeOffSortOrder} />
                                  </span>
                                </th>
                                <th onClick={() => handleTimeOffSort("is_company_paid")}>
                                  <span className={styles.headerContent}>
                                    {t("paidTimeOff")}
                                    <SortArrow active={timeOffSortField === "is_company_paid"} order={timeOffSortOrder} />
                                  </span>
                                </th>
                                <th onClick={() => handleTimeOffSort("addedBy")}>
                                  <span className={styles.headerContent}>
                                    {t("addedBy")}
                                    <SortArrow active={timeOffSortField === "addedBy"} order={timeOffSortOrder} />
                                  </span>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortedTimeOff.map((to) => (
                                <tr key={to.id}>
                                  <td className={styles.nowrap}>
                                    {to.type === "hour"
                                      ? `${fmtDateTime(to.date_from)} — ${fmtDateTime(to.date_to)}`
                                      : `${fmtDate(to.date_from)} — ${fmtDate(to.date_to)}`}
                                  </td>
                                  <td>
                                    <Chip tone={TIME_OFF_TONES[to.type] || "gray"}>
                                      {t(to.type)}
                                    </Chip>
                                  </td>
                                  <td>{to.reason || "—"}</td>
                                  <td>
                                    <Chip tone={to.is_company_paid ? "green" : "gray"}>
                                      {to.is_company_paid ? t("yes") : t("no")}
                                    </Chip>
                                  </td>
                                  <td>{to.addedBy}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalContainer,
  );
};

export default EmployeeProfile;
