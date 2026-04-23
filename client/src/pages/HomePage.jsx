import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Users,
  LayoutGrid,
  LogIn,
  UserX,
  LogOut,
  CalendarOff,
  Car,
  TrendingUp,
  Clock,
  Gift,
  ChevronDown,
  ChevronUp,
  MapPin,
  RefreshCw,
  Search,
  X,
  Briefcase,
  Wallet,
  CheckSquare,
  DollarSign,
  CreditCard,
  AlertCircle,
  Timer,
  AlarmClock,
  UserCircle,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  getDashboardSummary,
  getDashboardAnalytics,
  getDashboardFeeds,
} from "../api/dashboard";
import { getAttendance } from "../api/attendance";
import { getEmploymentOrders } from "../api/employmentOrders";
import { EmployeeService } from "../api";
import { useAuthStore } from "../stores/authStore";
import styles from "./HomePage.module.scss";

// ─── Design tokens ──────────────────────────────────────────────────────────────
const PIE_COLORS = [
  "#6366f1",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#22c55e",
  "#3b82f6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#a855f7",
];

// ─── Attendance section stat cards ─────────────────────────────────────────────
const ATTENDANCE_STAT_DEFS = [
  {
    key: "totalEmployees",
    icon: Users,
    gradient: "linear-gradient(135deg,#10b981,#059669)",
    bg: "rgba(16,185,129,0.12)",
    stroke: "#10b981",
    pctKey: null,
  },
  {
    key: "checkedInToday",
    icon: LogIn,
    gradient: "linear-gradient(135deg,#22c55e,#16a34a)",
    bg: "rgba(34,197,94,0.12)",
    stroke: "#22c55e",
    pctKey: "totalEmployees",
  },
  {
    key: "absentToday",
    icon: UserX,
    gradient: "linear-gradient(135deg,#ef4444,#dc2626)",
    bg: "rgba(239,68,68,0.12)",
    stroke: "#ef4444",
    pctKey: "totalEmployees",
  },
  {
    key: "timeOffToday",
    icon: CalendarOff,
    gradient: "linear-gradient(135deg,#8b5cf6,#7c3aed)",
    bg: "rgba(139,92,246,0.12)",
    stroke: "#8b5cf6",
    pctKey: "totalEmployees",
  },
  {
    key: "lateToday",
    icon: Clock,
    gradient: "linear-gradient(135deg,#f59e0b,#d97706)",
    bg: "rgba(245,158,11,0.12)",
    stroke: "#f59e0b",
    pctKey: "checkedInToday",
  },
  {
    key: "currentlyOnSite",
    icon: MapPin,
    gradient: "linear-gradient(135deg,#06b6d4,#3b82f6)",
    bg: "rgba(6,182,212,0.12)",
    stroke: "#06b6d4",
    pctKey: "totalEmployees",
  },
  {
    key: "checkedOutToday",
    icon: LogOut,
    gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    bg: "rgba(99,102,241,0.12)",
    stroke: "#6366f1",
    pctKey: "checkedInToday",
  },
];

// ─── Company section stat cards ─────────────────────────────────────────────────
const COMPANY_STAT_DEFS = [
  {
    key: "totalBranches",
    icon: Building2,
    gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    bg: "rgba(99,102,241,0.12)",
    stroke: "#6366f1",
    pctKey: null,
  },
  {
    key: "totalDepartments",
    icon: LayoutGrid,
    gradient: "linear-gradient(135deg,#06b6d4,#3b82f6)",
    bg: "rgba(6,182,212,0.12)",
    stroke: "#06b6d4",
    pctKey: null,
  },
  {
    key: "totalEmployees",
    icon: Users,
    gradient: "linear-gradient(135deg,#10b981,#059669)",
    bg: "rgba(16,185,129,0.12)",
    stroke: "#10b981",
    pctKey: null,
  },
];

// ─── Animated counter ───────────────────────────────────────────────────────────
function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    if (target == null || target === 0) {
      setVal(0);
      return;
    }
    const startTime = performance.now();
    const animate = (now) => {
      const p = Math.min((now - startTime) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
}

// ─── Motion variants ────────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.38, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055 } },
};
const rowFade = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

// ─── Skeleton ───────────────────────────────────────────────────────────────────
const Sk = ({ h = 80, w = "100%", r = 10 }) => (
  <div
    className={styles.skeleton}
    style={{ height: h, width: w, borderRadius: r }}
  />
);

// ─── Stat card ──────────────────────────────────────────────────────────────────
const StatCard = ({
  icon: Icon,
  label,
  value,
  gradient,
  bg,
  stroke,
  loading,
  pct,
}) => {
  const animated = useCountUp(loading ? null : (value ?? 0));
  return (
    <motion.div
      variants={fadeUp}
      className={styles.statCard}
      whileHover={{ y: -4, transition: { duration: 0.18 } }}
    >
      <div className={styles.statAccent} style={{ background: gradient }} />
      <div className={styles.statBody}>
        <div className={styles.statIconWrap} style={{ background: bg }}>
          <Icon size={20} color={stroke} strokeWidth={2} />
        </div>
        <div className={styles.statContent}>
          <span className={styles.statLabel}>{label}</span>
          <span className={styles.statValue} style={{ color: stroke }}>
            {loading ? (
              <Sk h={26} w={52} r={6} />
            ) : value != null ? (
              animated
            ) : (
              "—"
            )}
          </span>
          {pct != null && !loading && (
            <span className={styles.statPct}>{pct}%</span>
          )}
        </div>
      </div>
      <div className={styles.statBg} style={{ background: gradient }} />
    </motion.div>
  );
};

// ─── Mock widget card ────────────────────────────────────────────────────────────
const MockCard = ({
  icon: Icon,
  color,
  label,
  value,
  sub,
  badge,
  progress,
}) => (
  <motion.div
    variants={fadeUp}
    className={styles.mockCard}
    whileHover={{ y: -3, transition: { duration: 0.18 } }}
  >
    <div className={styles.mockCardInner}>
      <div className={styles.mockIconWrap} style={{ background: color + "18" }}>
        <Icon size={18} color={color} strokeWidth={2} />
      </div>
      <div className={styles.mockContent}>
        <span className={styles.mockLabel}>{label}</span>
        <span className={styles.mockValue} style={{ color }}>
          {value}
        </span>
        {sub && <span className={styles.mockSub}>{sub}</span>}
      </div>
      {badge && (
        <span
          className={styles.mockBadge}
          style={{ background: color + "18", color }}
        >
          {badge}
        </span>
      )}
    </div>
    {progress != null && (
      <div className={styles.mockProgressTrack}>
        <motion.div
          className={styles.mockProgressFill}
          style={{ background: `linear-gradient(90deg,${color},${color}99)` }}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.3 }}
        />
      </div>
    )}
  </motion.div>
);

// ─── Card wrapper ────────────────────────────────────────────────────────────────
const Card = ({
  title,
  icon: Icon,
  iconColor,
  children,
  loading,
  skH = 240,
  className = "",
  headerExtra,
  style,
}) => (
  <motion.div
    variants={rowFade}
    className={`${styles.card} ${className}`}
    style={style}
  >
    <div className={styles.cardHeader}>
      <div className={styles.cardTitleRow}>
        {Icon && (
          <span
            className={styles.cardIconWrap}
            style={{ background: iconColor + "15", color: iconColor }}
          >
            <Icon size={15} strokeWidth={2.2} />
          </span>
        )}
        <h3 className={styles.cardTitle}>{title}</h3>
      </div>
      {headerExtra && (
        <div className={styles.cardHeaderExtra}>{headerExtra}</div>
      )}
    </div>
    <div className={styles.cardBody}>{loading ? <Sk h={skH} /> : children}</div>
  </motion.div>
);

// ─── Placeholder card ───────────────────────────────────────────────────────────
const PlaceholderCard = ({ title, icon: Icon, iconColor, t }) => (
  <motion.div variants={rowFade} className={styles.card}>
    <div className={styles.cardHeader}>
      <div className={styles.cardTitleRow}>
        {Icon && (
          <span
            className={styles.cardIconWrap}
            style={{ background: iconColor + "15", color: iconColor }}
          >
            <Icon size={15} strokeWidth={2.2} />
          </span>
        )}
        <h3 className={styles.cardTitle}>{title}</h3>
      </div>
    </div>
    <div className={styles.cardBody}>
      <div className={styles.placeholderBody}>
        <span className={styles.placeholderBadge}>
          {t("dashboard.comingSoon")}
        </span>
      </div>
    </div>
  </motion.div>
);

// ─── Dashboard section wrapper ──────────────────────────────────────────────────
const DashboardSection = ({ title, icon: Icon, iconColor, children }) => (
  <div className={styles.section}>
    <div className={styles.sectionHeader}>
      {Icon && (
        <span
          className={styles.sectionIconWrap}
          style={{ background: iconColor + "18", color: iconColor }}
        >
          <Icon size={16} strokeWidth={2.2} />
        </span>
      )}
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.sectionLine} />
    </div>
    <div className={styles.sectionBody}>{children}</div>
  </div>
);

// ─── Empty state ─────────────────────────────────────────────────────────────────
const Empty = ({ text }) => (
  <div className={styles.empty}>
    <span className={styles.emptyDot} />
    {text}
  </div>
);

// ─── Custom tooltip ──────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipLabel}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} className={styles.tooltipRow}>
          <span className={styles.tooltipDot} style={{ background: p.color }} />
          <span>{p.name}:</span>
          <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// ─── Horizontal bar ──────────────────────────────────────────────────────────────
const HBar = ({
  label,
  count,
  max,
  color = "linear-gradient(90deg,#6366f1,#8b5cf6)",
  delay = 0,
}) => (
  <div className={styles.hbarRow}>
    <span className={styles.hbarLabel}>{label}</span>
    <div className={styles.hbarTrack}>
      <motion.div
        className={styles.hbarFill}
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: max > 0 ? `${(count / max) * 100}%` : 0 }}
        transition={{ duration: 0.7, ease: "easeOut", delay }}
      />
    </div>
    <span className={styles.hbarCount}>{count}</span>
  </div>
);

// ─── Department rank bar ─────────────────────────────────────────────────────────
const DeptBar = ({ label, branchName, count, max, delay = 0 }) => {
  const pct = max > 0 ? (count / max) * 100 : 0;

  return (
    <div className={styles.deptBarRow}>
      <div className={styles.deptBarInfo}>
        <span className={styles.deptBarLabel}>{label}</span>
        {branchName && (
          <span className={styles.deptBarBranch}>{branchName}</span>
        )}
      </div>
      <div className={styles.deptBarTrack}>
        <motion.div
          className={styles.deptBarFill}
          style={{
            background: `linear-gradient(90deg,#06b6d4,#3b82f6)`,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.65, ease: "easeOut", delay }}
        />
      </div>
      <span className={styles.deptBarCount}>{count}</span>
    </div>
  );
};

// ─── Feed helpers ────────────────────────────────────────────────────────────────
const fmtTime = (d) =>
  !d
    ? "—"
    : new Date(d).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      });
const fmtDateTime = (d) =>
  !d
    ? "—"
    : new Date(d).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
const fmtDateShort = (d) =>
  !d
    ? "—"
    : new Date(d).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
const initials = (e) =>
  ((e?.first_name?.[0] || "") + (e?.last_name?.[0] || "")).toUpperCase() || "?";
const attInitials = (fullName) => {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
};
const fullName = (e) =>
  [e?.last_name, e?.first_name].filter(Boolean).join(" ") || "—";

// ─── Pass feed item ──────────────────────────────────────────────────────────────
const DIRECTION_STYLE = {
  entry: {
    bg: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    badge: "badgeEntry",
    key: "entry",
  },
  exit: {
    bg: "linear-gradient(135deg,#f59e0b,#d97706)",
    badge: "badgeExit",
    key: "exit",
  },
  unknown: {
    bg: "linear-gradient(135deg,#94a3b8,#64748b)",
    badge: "badgeUnknown",
    key: "unknown",
  },
};

const PassItem = ({ item, t, isVehicle }) => {
  const dir = DIRECTION_STYLE[item.direction] ?? DIRECTION_STYLE.unknown;
  const imgSrc = isVehicle
    ? item.photo
      ? `/api/vehicle-passes/image/${item.photo}`
      : null
    : item.photo
      ? `/api/face-passes/image/${item.photo}`
      : item.employee?.photo
        ? `/api/employees/image/${item.employee.photo}`
        : null;

  return (
    <div className={styles.feedItem}>
      <div
        className={`${styles.feedAvatar} ${isVehicle ? styles.feedAvatarCar : ""}`}
        style={isVehicle ? {} : { background: dir.bg }}
      >
        {imgSrc ? (
          <img src={imgSrc} alt="" />
        ) : isVehicle ? (
          <Car size={16} strokeWidth={1.5} />
        ) : (
          <span className={styles.feedInitials}>{initials(item.employee)}</span>
        )}
      </div>
      <div className={styles.feedInfo}>
        <span className={styles.feedName}>
          {isVehicle ? item.plate_number || "—" : fullName(item.employee)}
        </span>
        <span className={styles.feedSub}>
          {isVehicle ? item.gate?.name || "—" : item.door?.name || "—"}
        </span>
      </div>
      <div className={styles.feedRight}>
        <span className={styles.feedDateTime}>{fmtDateTime(item.date)}</span>
        <span className={styles[dir.badge]}>{t(dir.key)}</span>
      </div>
    </div>
  );
};

// ─── Time-off item ───────────────────────────────────────────────────────────────
const TimeOffItem = ({ item, t }) => (
  <div className={styles.feedItem}>
    <div
      className={styles.feedAvatar}
      style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)" }}
    >
      <span className={styles.feedInitials}>{initials(item.employee)}</span>
    </div>
    <div className={styles.feedInfo}>
      <span className={styles.feedName}>{fullName(item.employee)}</span>
      <span className={styles.feedSub}>{item.reason || "—"}</span>
    </div>
    <div className={styles.feedRight}>
      <span className={styles.feedDateTime}>
        {fmtDateShort(item.date_from)} — {fmtDateShort(item.date_to)}
      </span>
      <span className={styles.badgeTimeOff}>{t(item.type) || item.type}</span>
    </div>
  </div>
);

// ─── Birthday item ───────────────────────────────────────────────────────────────
const BirthdayItem = ({ item, t }) => {
  const isToday = item.daysLeft === 0;
  return (
    <div className={`${styles.bdayItem} ${isToday ? styles.bdayToday : ""}`}>
      <div className={styles.bdayAvatar}>
        {item.photo ? (
          <img src={`/api/employees/image/${item.photo}`} alt="" />
        ) : (
          <span>{initials(item)}</span>
        )}
      </div>
      <div className={styles.bdayInfo}>
        <span className={styles.bdayName}>{fullName(item)}</span>
        <span className={styles.bdayDept}>{item.department?.name}</span>
      </div>
      <div className={styles.bdayRight}>
        <span className={styles.bdayDate}>
          {new Date(item.date_of_birth).toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "short",
          })}
        </span>
        {isToday ? (
          <span className={styles.bdayTodayBadge}>🎉</span>
        ) : (
          <span className={styles.bdayDays}>
            {t("dashboard.inDays", { count: item.daysLeft })}
          </span>
        )}
      </div>
    </div>
  );
};

// ─── Pie legend with expand ──────────────────────────────────────────────────────
const PieLegend = ({ data, nameKey = "branch" }) => {
  const use2Col = data.length > 5;
  return (
    <div className={styles.pieLegendWrap}>
      <ul
        className={`${styles.pieLegend} ${use2Col ? styles.pieLegend2Col : ""}`}
      >
        {data.map((item, i) => (
          <li key={i}>
            <span
              className={styles.pieDot}
              style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
            />
            <span className={styles.pieName}>{item[nameKey]}</span>
            <span className={styles.pieCount}>{item.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

// ─── Top arrivals/departures list ────────────────────────────────────────────────
const ArrivalItem = ({ item, timeKey, label }) => (
  <div className={styles.arrItem}>
    <div className={styles.arrAvatar}>
      {item.employee?.photo ? (
        <img src={`/api/employees/image/${item.employee.photo}`} alt="" />
      ) : (
        <span>{initials(item.employee)}</span>
      )}
    </div>
    <div className={styles.arrInfo}>
      <span className={styles.arrName}>{fullName(item.employee)}</span>
      <span className={styles.arrDept}>
        {item.employee?.department?.name || "—"}
      </span>
    </div>
    <div className={styles.arrTime}>
      <span className={styles.arrTimeVal}>{fmtTime(item[timeKey])}</span>
      <span className={styles.arrTimeLabel}>{label}</span>
    </div>
  </div>
);

// ─── Time helpers for attendance module (HH:MM strings or ISO datetimes) ────────
const fmtTimeOrStr = (val) => {
  if (!val) return "—";
  if (/^\d{1,2}:\d{2}/.test(String(val))) return String(val).slice(0, 5);
  const d = new Date(val);
  return isNaN(d)
    ? String(val)
    : d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
};
const fmtLateMin = (mins) => {
  if (!mins || mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `+${h}ч ${m}м` : `+${m} мин`;
};

// ─── Late item (schedule / actual / late minutes) ─────────────────────────────────
const LateItem = ({ emp }) => (
  <div className={styles.lateItem}>
    <div className={styles.arrAvatar}>
      {emp.employeePhoto ? (
        <img src={`/api/employees/image/${emp.employeePhoto}`} alt="" />
      ) : (
        <span>{attInitials(emp.employeeFullName)}</span>
      )}
    </div>
    <div className={styles.lateInfo}>
      <span className={styles.arrName}>{emp.employeeFullName || "—"}</span>
      <span className={styles.arrDept}>{emp.departmentName || "—"}</span>
    </div>

    <div className={styles.lateTimes}>
      <span className={styles.lateTimeChip}>
        <span className={styles.lateTimeLbl}>График</span>
        {emp.scheduledStart?.slice(0, 5) || "—"}
      </span>
      <span className={styles.lateTimeDot} />
      <span className={styles.lateTimeChip}>
        <span className={styles.lateTimeLbl}>Факт</span>
        {fmtTimeOrStr(emp.actualStart)}
      </span>
      {fmtLateMin(emp.lateMinutes) && (
        <span className={styles.lateBadge}>{fmtLateMin(emp.lateMinutes)}</span>
      )}
    </div>
  </div>
);

// ─── Attendance list item (attendance module data shape) ─────────────────────────
const AttItem = ({ emp, timeVal, timeLabel }) => (
  <div className={styles.arrItem}>
    <div className={styles.arrAvatar}>
      {emp.employeePhoto ? (
        <img src={`/api/employees/image/${emp.employeePhoto}`} alt="" />
      ) : (
        <span>{attInitials(emp.employeeFullName)}</span>
      )}
    </div>
    <div className={styles.arrInfo}>
      <span className={styles.arrName}>{emp.employeeFullName || "—"}</span>
      <span className={styles.arrDept}>{emp.departmentName || "—"}</span>
    </div>
    {timeVal && (
      <div className={styles.arrTime}>
        <span className={styles.arrTimeVal}>{fmtTime(timeVal)}</span>
        <span className={styles.arrTimeLabel}>{timeLabel}</span>
      </div>
    )}
  </div>
);

// ─── Quick search overlay ────────────────────────────────────────────────────────
const QuickSearch = ({ open, onClose, menuItems, t }) => {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [employees, setEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setEmployees([]);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  useEffect(() => {
    if (!q.trim() || q.trim().length < 2) {
      setEmployees([]);
      return;
    }
    const timer = setTimeout(async () => {
      setEmpLoading(true);
      try {
        const { data } = await EmployeeService.getAll({
          search: q.trim(),
          pageSize: 5,
        });
        setEmployees(data || []);
      } catch {
        setEmployees([]);
      } finally {
        setEmpLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  const pageResults = q.trim()
    ? menuItems.filter((m) =>
        (m.name || "").toLowerCase().includes(q.toLowerCase()),
      )
    : menuItems.slice(0, 8);

  const select = (path) => {
    navigate(path);
    onClose();
  };

  const empFullName = (emp) =>
    [emp.last_name, emp.first_name, emp.middle_name]
      .filter(Boolean)
      .join(" ") || "—";

  const hasResults = employees.length > 0 || pageResults.length > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={styles.searchOverlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={styles.searchBox}
            initial={{ opacity: 0, scale: 0.96, y: -12 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              transition: { duration: 0.22 },
            }}
            exit={{
              opacity: 0,
              scale: 0.96,
              y: -12,
              transition: { duration: 0.15 },
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.searchInputRow}>
              <Search size={16} className={styles.searchIcon} />
              <input
                ref={inputRef}
                className={styles.searchInput}
                placeholder={t("dashboard.searchPlaceholder")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q && (
                <button className={styles.searchClear} onClick={() => setQ("")}>
                  <X size={14} />
                </button>
              )}
              <kbd className={styles.searchEsc}>Esc</kbd>
            </div>
            <div className={styles.searchResults}>
              {employees.length > 0 && (
                <>
                  <div className={styles.searchSectionLabel}>
                    {t("employees")}
                  </div>
                  {employees.map((emp) => (
                    <button
                      key={emp.id}
                      className={styles.searchResultItem}
                      onClick={() => select("/employees")}
                    >
                      <UserCircle
                        size={13}
                        className={styles.searchResultIcon}
                      />
                      <span>{empFullName(emp)}</span>
                      <span className={styles.searchResultPath}>
                        #{emp.id}
                        {emp.department?.name
                          ? ` · ${emp.department.name}`
                          : ""}
                      </span>
                    </button>
                  ))}
                </>
              )}

              {pageResults.length > 0 && (
                <>
                  {employees.length > 0 && (
                    <div className={styles.searchSectionLabel}>
                      {t("dashboard.pages") || "Страницы"}
                    </div>
                  )}
                  {pageResults.map((m, i) => (
                    <button
                      key={i}
                      className={styles.searchResultItem}
                      onClick={() => select(m.path)}
                    >
                      <Zap size={13} className={styles.searchResultIcon} />
                      <span>{t(m.name) || m.name}</span>
                      <span className={styles.searchResultPath}>{m.path}</span>
                    </button>
                  ))}
                </>
              )}

              {empLoading && <div className={styles.searchEmpty}>...</div>}

              {!empLoading && q.trim().length >= 2 && !hasResults && (
                <div className={styles.searchEmpty}>
                  {t("dashboard.noSearchResults")}
                </div>
              )}

              {!q.trim() && pageResults.length === 0 && (
                <div className={styles.searchEmpty}>
                  {t("dashboard.noSearchResults")}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ─── Greeting ───────────────────────────────────────────────────────────────────
const Greeting = ({ user, t, onRefresh, refreshing, onSearch }) => {
  const now = new Date();
  const dateStr = now.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <motion.div className={styles.greeting} variants={rowFade}>
      <div className={styles.greetingLeft}>
        <div className={styles.greetingText}>
          <span className={styles.greetingHi}>
            {t(`dashboard.greeting`)}
            {user?.first_name ? `, ${user.first_name}` : ""}! 👋
          </span>
        </div>
        <span className={styles.greetingDate}>{dateStr}</span>
      </div>

      <div className={styles.greetingActions}>
        <button className={styles.searchTriggerBtn} onClick={onSearch}>
          <Search size={18} />
          <span>{t("dashboard.quickSearch")}</span>
        </button>
        <button
          className={`${styles.refreshBtn} ${refreshing ? styles.refreshBtnSpin : ""}`}
          onClick={onRefresh}
          title={t("dashboard.refresh")}
        >
          <RefreshCw size={15} />
        </button>
      </div>
    </motion.div>
  );
};

// ─── MAIN ───────────────────────────────────────────────────────────────────────
const HomePage = () => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const access = useAuthStore((s) => s.access);

  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [feeds, setFeeds] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [sumLoading, setSumLoading] = useState(true);
  const [anaLoading, setAnaLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(true);
  const [attLoading, setAttLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [attendancePeriod, setAttendancePeriod] = useState("week");
  const [hiringPeriod, setHiringPeriod] = useState("month");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [branchDropOpen, setBranchDropOpen] = useState(false);
  const [newEmployees, setNewEmployees] = useState([]);
  const [terminatedEmployees, setTerminatedEmployees] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const branchDropRef = useRef(null);

  // ── access helpers ────────────────────────────────────────────────────────────
  const branchCount =
    access?.access_level === "absolute"
      ? (access?.branches?.length ?? 0)
      : (access?.branch_access?.length ?? 0);
  const showBranchWidgets = branchCount > 1;
  const hasVehicleAccess =
    access?.menu?.some((m) => m.path?.includes("vehicle-passes")) ?? true;

  // ── menu items for search ─────────────────────────────────────────────────────
  const menuItems = access?.menu?.filter((m) => m.path) ?? [];

  // ── data loading ──────────────────────────────────────────────────────────────
  useEffect(() => {
    setSumLoading(true);
    getDashboardSummary()
      .then(setSummary)
      .catch(console.error)
      .finally(() => setSumLoading(false));
  }, [refreshKey]);

  useEffect(() => {
    setAnaLoading(true);
    setFeedLoading(true);
    getDashboardAnalytics()
      .then(setAnalytics)
      .catch(console.error)
      .finally(() => setAnaLoading(false));
    getDashboardFeeds()
      .then(setFeeds)
      .catch(console.error)
      .finally(() => setFeedLoading(false));
  }, [refreshKey]);

  useEffect(() => {
    setAttLoading(true);
    const today = new Date().toISOString().split("T")[0];
    getAttendance({ filters: { date: today } })
      .then((res) => {
        setAttendanceData(res.data);
        const firstId = res.data.branches?.[0]?.id;
        if (firstId) {
          setSelectedBranch((prev) =>
            prev === "all" ? String(firstId) : prev,
          );
        }
      })
      .catch(console.error)
      .finally(() => setAttLoading(false));
  }, [refreshKey]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // ── Ctrl+K listener ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Employment orders (new hires + terminated) ────────────────────────────────
  useEffect(() => {
    setOrdersLoading(true);
    Promise.all([
      getEmploymentOrders({ filters: { type: "hire" }, pageSize: 5 }),
      getEmploymentOrders({ filters: { type: "terminate" }, pageSize: 5 }),
    ])
      .then(([hires, terms]) => {
        setNewEmployees(hires.data ?? []);
        setTerminatedEmployees(terms.data ?? []);
      })
      .catch(console.error)
      .finally(() => setOrdersLoading(false));
  }, [refreshKey]);

  // ── Branch dropdown outside click ─────────────────────────────────────────────
  useEffect(() => {
    if (!branchDropOpen) return;
    const handler = (e) => {
      if (branchDropRef.current && !branchDropRef.current.contains(e.target)) {
        setBranchDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [branchDropOpen]);

  // ── Attendance stats — defined FIRST so nothing below references it before init
  const attStats = {
    totalEmployees: attendanceData?.employees?.length ?? 0,
    checkedInToday: attendanceData?.present?.length ?? 0,
    absentToday: attendanceData?.absent?.length ?? 0,
    lateToday: attendanceData?.late?.length ?? 0,
    currentlyOnSite: attendanceData?.inside?.length ?? 0,
    checkedOutToday: attendanceData?.left?.length ?? 0,
    timeOffToday: summary?.timeOffToday ?? 0,
  };

  const branchMax = analytics?.branchActivity?.[0]?.count ?? 1;
  const positionMax = analytics?.employeesByPosition?.[0]?.count ?? 1;

  const pct = (val, total) =>
    total > 0 && val != null ? Math.round((val / total) * 100) : null;

  // ── Branches for attendance selector (from attendance module) ────────────────
  const attBranches = attendanceData?.branches ?? [];
  const branchNameToId = Object.fromEntries(
    attBranches.map((b) => [b.name, b.id]),
  );

  // ── Department attendance (computed from present array) ───────────────────────
  const deptAttendance = (() => {
    const present = attendanceData?.present ?? [];
    const map = {};
    for (const emp of present) {
      const dept = emp.departmentName || "—";
      const bName = emp.branchName || "—";
      const bId = branchNameToId[bName] ?? null;
      const key = `${bId}-${dept}`;
      if (!map[key])
        map[key] = {
          department: dept,
          branchName: bName,
          branchId: bId,
          count: 0,
        };
      map[key].count++;
    }
    return Object.values(map).sort((a, b) => b.count - a.count);
  })();

  // ── Attendance bar/line chart data ───────────────────────────────────────────
  const totalEmp = attStats.totalEmployees || summary?.totalEmployees || 0;
  const attendanceChartData = (analytics?.weeklyAttendance ?? []).map((d) => ({
    date: d.date,
    came: d.count,
    absent: Math.max(0, totalEmp - d.count),
  }));
  const monthlyChartData = (analytics?.monthlyAttendance ?? []).map((d) => ({
    date: d.date,
    came: d.count,
    absent: Math.max(0, totalEmp - d.count),
  }));

  // ── Finance placeholder mock stats ────────────────────────────────────────────
  const FINANCE_MOCK = [
    {
      icon: Wallet,
      color: "#f59e0b",
      labelKey: "payrollFund",
      value: "—",
      sub: t("dashboard.comingSoon"),
    },
    {
      icon: CreditCard,
      color: "#10b981",
      labelKey: "payrollPaid",
      value: "—",
      sub: null,
    },
    {
      icon: AlertCircle,
      color: "#ef4444",
      labelKey: "payrollRemaining",
      value: "—",
      sub: null,
    },
    {
      icon: TrendingUp,
      color: "#3b82f6",
      labelKey: "averageSalary",
      value: "—",
      sub: null,
    },
    {
      icon: DollarSign,
      color: "#8b5cf6",
      labelKey: "maxSalary",
      value: "—",
      sub: null,
    },
  ];

  // ── Tasks placeholder mock stats ──────────────────────────────────────────────
  const TASKS_MOCK = [
    {
      icon: CheckSquare,
      color: "#6366f1",
      labelKey: "totalTasks",
      value: "—",
      sub: t("dashboard.comingSoon"),
    },
    {
      icon: Timer,
      color: "#06b6d4",
      labelKey: "tasksInProgress",
      value: "—",
      sub: null,
    },
    {
      icon: AlertCircle,
      color: "#ef4444",
      labelKey: "tasksOverdue",
      value: "—",
      sub: null,
    },
    {
      icon: Zap,
      color: "#10b981",
      labelKey: "tasksCompleted",
      value: "—",
      sub: null,
    },
  ];

  return (
    <div className={styles.page}>
      <QuickSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        menuItems={menuItems}
        t={t}
      />

      {/* ── Page actions bar ──────────────────────────────────── */}
      <div className={styles.pageActionsBar}>
        <button
          className={styles.searchTriggerBtn}
          onClick={() => setSearchOpen(true)}
        >
          <Search size={15} />
          <span>{t("dashboard.quickSearch")}</span>
        </button>
        <button
          className={`${styles.refreshBtn} ${refreshing ? styles.refreshBtnSpin : ""}`}
          onClick={handleRefresh}
          title={t("dashboard.refresh")}
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION 1: ПОСЕЩАЕМОСТЬ
      ══════════════════════════════════════════════════════════ */}
      <DashboardSection
        title={t("dashboard.sectionAttendance")}
        icon={LogIn}
        iconColor="#6366f1"
      >
        {/* Widgets row — full width single row */}
        <motion.div
          className={styles.gridFull}
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          {ATTENDANCE_STAT_DEFS.map(
            ({ key, icon, gradient, bg, stroke, pctKey }) => (
              <StatCard
                key={key}
                icon={icon}
                label={t(`dashboard.${key}`)}
                value={attStats[key]}
                gradient={gradient}
                bg={bg}
                stroke={stroke}
                loading={attLoading}
                pct={pctKey ? pct(attStats[key], attStats[pctKey]) : null}
              />
            ),
          )}
        </motion.div>

        {/* Analytics: attendance bar chart + branch dept attendance */}
        <motion.div
          className={styles.row2Eq}
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.05 }}
        >
          <Card
            title={t("dashboard.weeklyAttendance")}
            icon={TrendingUp}
            iconColor="#6366f1"
            loading={anaLoading}
            skH={260}
            headerExtra={
              <div className={styles.periodToggle}>
                <button
                  className={`${styles.periodBtn} ${attendancePeriod === "week" ? styles.periodBtnActive : ""}`}
                  onClick={() => setAttendancePeriod("week")}
                >
                  {t("dashboard.week")}
                </button>
                <button
                  className={`${styles.periodBtn} ${attendancePeriod === "month" ? styles.periodBtnActive : ""}`}
                  onClick={() => setAttendancePeriod("month")}
                >
                  {t("dashboard.month")}
                </button>
              </div>
            }
          >
            {attendancePeriod === "week" ? (
              attendanceChartData.length ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={attendanceChartData}
                    margin={{ left: -10, right: 8 }}
                    barGap={3}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border-color)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{
                        fontSize: 11,
                        fill: "var(--text-color)",
                        opacity: 0.6,
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{
                        fontSize: 11,
                        fill: "var(--text-color)",
                        opacity: 0.6,
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11 }}
                    />
                    <Bar
                      dataKey="came"
                      name={t("dashboard.checkedInToday")}
                      fill="#22c55e"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                    <Bar
                      dataKey="absent"
                      name={t("dashboard.absentToday")}
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty text={t("noData")} />
              )
            ) : monthlyChartData.length ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={monthlyChartData}
                  margin={{ left: -10, right: 8 }}
                  barGap={2}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border-color)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{
                      fontSize: 9,
                      fill: "var(--text-color)",
                      opacity: 0.6,
                    }}
                    axisLine={false}
                    tickLine={false}
                    interval={4}
                  />
                  <YAxis
                    tick={{
                      fontSize: 11,
                      fill: "var(--text-color)",
                      opacity: 0.6,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 11 }}
                  />
                  <Bar
                    dataKey="came"
                    name={t("dashboard.checkedInToday")}
                    fill="#22c55e"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={12}
                  />
                  <Bar
                    dataKey="absent"
                    name={t("dashboard.absentToday")}
                    fill="#ef4444"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={12}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty text={t("noData")} />
            )}
          </Card>

          <Card
            title={t("dashboard.attendanceByBranch")}
            icon={LayoutGrid}
            iconColor="#06b6d4"
            loading={attLoading}
            skH={260}
            headerExtra={
              attBranches.length > 1 ? (
                <div className={styles.branchDrop} ref={branchDropRef}>
                  <button
                    className={styles.branchDropTrigger}
                    onClick={() => setBranchDropOpen((v) => !v)}
                  >
                    <Building2 size={12} strokeWidth={2} />
                    <span className={styles.branchDropVal}>
                      {attBranches.find((b) => String(b.id) === selectedBranch)
                        ?.name || "—"}
                    </span>
                    <motion.span
                      className={styles.branchDropChevron}
                      animate={{ rotate: branchDropOpen ? 180 : 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      <ChevronDown size={11} strokeWidth={2.5} />
                    </motion.span>
                  </button>
                  <AnimatePresence>
                    {branchDropOpen && (
                      <motion.div
                        className={styles.branchDropList}
                        initial={{ opacity: 0, y: -6, scaleY: 0.9 }}
                        animate={{ opacity: 1, y: 0, scaleY: 1 }}
                        exit={{ opacity: 0, y: -6, scaleY: 0.9 }}
                        transition={{ duration: 0.14 }}
                        style={{ transformOrigin: "top" }}
                      >
                        {attBranches.map((b) => (
                          <button
                            key={b.id}
                            className={`${styles.branchDropItem} ${String(b.id) === selectedBranch ? styles.branchDropItemActive : ""}`}
                            onClick={() => {
                              setSelectedBranch(String(b.id));
                              setBranchDropOpen(false);
                            }}
                          >
                            {b.name}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : null
            }
          >
            {(() => {
              const filtered =
                selectedBranch === "all"
                  ? deptAttendance
                  : deptAttendance.filter(
                      (d) => String(d.branchId) === selectedBranch,
                    );
              const top10 = filtered.slice(0, 10);
              const localMax = top10[0]?.count ?? 1;
              return top10.length ? (
                <div className={styles.deptBarList}>
                  {top10.map((item, i) => (
                    <DeptBar
                      key={`${item.branchId}-${item.department}`}
                      rank={i + 1}
                      label={item.department}
                      branchName={null}
                      count={item.count}
                      max={localMax}
                      delay={i * 0.06}
                    />
                  ))}
                </div>
              ) : (
                <Empty text={t("noData")} />
              );
            })()}
          </Card>
        </motion.div>

        {/* Top lists: late arrivals, early departures, absent — equal heights */}
        <motion.div
          className={styles.row3Eq}
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.05 }}
        >
          <Card
            title={t("dashboard.topLateArrivals")}
            icon={AlarmClock}
            iconColor="#ef4444"
            loading={attLoading}
            skH={240}
            className={styles.cardEq}
          >
            {(() => {
              const list = (attendanceData?.late ?? [])
                .slice()
                .sort((a, b) => b.lateMinutes - a.lateMinutes)
                .slice(0, 5);
              return list.length ? (
                <div className={styles.lateList}>
                  {list.map((emp) => (
                    <LateItem key={emp.employeeId} emp={emp} />
                  ))}
                </div>
              ) : (
                <Empty text={t("noData")} />
              );
            })()}
          </Card>

          <Card
            title={t("dashboard.topEarlyDepartures")}
            icon={Timer}
            iconColor="#f59e0b"
            loading={attLoading}
            skH={240}
            className={styles.cardEq}
          >
            {(() => {
              const list = (attendanceData?.left ?? [])
                .filter((e) => e.lastExit)
                .slice()
                .sort((a, b) => new Date(a.lastExit) - new Date(b.lastExit))
                .slice(0, 5);
              return list.length ? (
                <div className={styles.arrList}>
                  {list.map((emp) => (
                    <AttItem
                      key={emp.employeeId}
                      emp={emp}
                      timeVal={emp.lastExit}
                      timeLabel={t("dashboard.departureTime")}
                    />
                  ))}
                </div>
              ) : (
                <Empty text={t("noData")} />
              );
            })()}
          </Card>

          <Card
            title={t("dashboard.absentEmployees")}
            icon={UserX}
            iconColor="#8b5cf6"
            loading={attLoading}
            skH={240}
            className={styles.cardEq}
          >
            {(() => {
              const list = (attendanceData?.absent ?? []).slice(0, 5);
              return list.length ? (
                <div className={styles.arrList}>
                  {list.map((emp) => (
                    <AttItem key={emp.employeeId} emp={emp} />
                  ))}
                </div>
              ) : (
                <Empty text={t("noData")} />
              );
            })()}
          </Card>
        </motion.div>

        {/* Recent events: time-offs, face passes, birthdays — equal heights, 5 rows */}
        <motion.div
          className={styles.row3Eq}
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.03 }}
        >
          <Card
            title={t("dashboard.recentTimeOffs")}
            icon={CalendarOff}
            iconColor="#ef4444"
            loading={feedLoading}
            skH={280}
            className={styles.cardEq}
          >
            {feeds?.recentTimeOffs?.length ? (
              <div className={styles.feedList}>
                {feeds.recentTimeOffs.slice(0, 5).map((item) => (
                  <TimeOffItem key={item.id} item={item} t={t} />
                ))}
              </div>
            ) : (
              <Empty text={t("noData")} />
            )}
          </Card>

          <Card
            title={t("dashboard.recentFacePasses")}
            icon={LogIn}
            iconColor="#6366f1"
            loading={feedLoading}
            skH={280}
            className={styles.cardEq}
          >
            {feeds?.recentFacePasses?.length ? (
              <div className={styles.feedList}>
                {feeds.recentFacePasses.slice(0, 5).map((p) => (
                  <PassItem key={p.id} item={p} t={t} isVehicle={false} />
                ))}
              </div>
            ) : (
              <Empty text={t("noData")} />
            )}
          </Card>

          <Card
            title={t("dashboard.upcomingBirthdays")}
            icon={Gift}
            iconColor="#ec4899"
            loading={feedLoading}
            skH={280}
            className={styles.cardEq}
          >
            {feeds?.upcomingBirthdays?.length ? (
              <div className={styles.bdayList}>
                {feeds.upcomingBirthdays.slice(0, 5).map((e) => (
                  <BirthdayItem key={e.id} item={e} t={t} />
                ))}
              </div>
            ) : (
              <Empty text={t("noData")} />
            )}
          </Card>
        </motion.div>
      </DashboardSection>

      {/* ══════════════════════════════════════════════════════════
          SECTION 2: КОМПАНИЯ
      ══════════════════════════════════════════════════════════ */}
      <DashboardSection
        title={t("dashboard.sectionCompany")}
        icon={Building2}
        iconColor="#10b981"
      >
        {/* Stat widgets: branches, departments, employees — full width */}
        <motion.div
          className={styles.gridFull}
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.05 }}
        >
          {COMPANY_STAT_DEFS.map(({ key, icon, gradient, bg, stroke }) => (
            <StatCard
              key={key}
              icon={icon}
              label={t(`dashboard.${key}`)}
              value={summary?.[key]}
              gradient={gradient}
              bg={bg}
              stroke={stroke}
              loading={sumLoading}
              pct={null}
            />
          ))}
          <StatCard
            icon={Briefcase}
            label={t("dashboard.totalPositions")}
            value={summary?.totalPositions}
            gradient="linear-gradient(135deg,#6366f1,#8b5cf6)"
            bg="rgba(99,102,241,0.12)"
            stroke="#6366f1"
            loading={sumLoading}
            pct={null}
          />
          <MockCard
            icon={UserCircle}
            color="#ec4899"
            label={t("dashboard.totalVacancies")}
            value="—"
            sub={t("dashboard.comingSoon")}
          />
        </motion.div>

        {/* Row 3: hiring chart + new employees + terminated — equal heights */}
        <motion.div
          className={styles.row3Eq}
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.05 }}
        >
          <Card
            title={t("dashboard.hiringDynamics")}
            icon={Users}
            iconColor="#10b981"
            loading={anaLoading}
            skH={230}
            className={styles.cardEq}
            headerExtra={
              <div className={styles.periodToggle}>
                <button
                  className={`${styles.periodBtn} ${hiringPeriod === "week" ? styles.periodBtnActive : ""}`}
                  onClick={() => setHiringPeriod("week")}
                >
                  {t("dashboard.week")}
                </button>
                <button
                  className={`${styles.periodBtn} ${hiringPeriod === "month" ? styles.periodBtnActive : ""}`}
                  onClick={() => setHiringPeriod("month")}
                >
                  {t("dashboard.month")}
                </button>
              </div>
            }
          >
            {(() => {
              const isWeek = hiringPeriod === "week";
              const chartData = isWeek
                ? (analytics?.weeklyHiringDynamics ?? [])
                : (analytics?.hiringDynamics ?? []);
              return chartData.length ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={chartData}
                    margin={{ left: -10, right: 8 }}
                    barGap={3}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border-color)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey={isWeek ? "date" : "month"}
                      tick={{
                        fontSize: isWeek ? 9.5 : 11,
                        fill: "var(--text-color)",
                        opacity: 0.6,
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{
                        fontSize: 11,
                        fill: "var(--text-color)",
                        opacity: 0.6,
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11 }}
                    />
                    <Bar
                      dataKey="hired"
                      name={t("dashboard.hired")}
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={24}
                    />
                    <Bar
                      dataKey="terminated"
                      name={t("dashboard.terminated")}
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty text={t("noData")} />
              );
            })()}
          </Card>

          <Card
            title={t("dashboard.newEmployees")}
            icon={UserCircle}
            iconColor="#22c55e"
            loading={ordersLoading}
            skH={200}
            className={styles.cardEq}
          >
            {newEmployees.length ? (
              <div className={styles.orderList}>
                {newEmployees.map((o) => (
                  <div key={o.id} className={styles.orderItem}>
                    <div
                      className={styles.orderAvatar}
                      style={{
                        background: "linear-gradient(135deg,#22c55e,#16a34a)",
                      }}
                    >
                      <span>
                        {(
                          [o.employee?.last_name, o.employee?.first_name]
                            .filter(Boolean)
                            .join(" ") || ""
                        )
                          .trim()
                          .split(/\s+/)
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase() || "?"}
                      </span>
                    </div>
                    <div className={styles.orderInfo}>
                      <span className={styles.orderName}>
                        {[
                          o.employee?.last_name,
                          o.employee?.first_name,
                          o.employee?.middle_name,
                          o.employee?.id,
                        ]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </span>
                      <span className={styles.orderDate}>
                        {fmtDateShort(o.date)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty text={t("noData")} />
            )}
          </Card>

          <Card
            title={t("dashboard.recentlyTerminated")}
            icon={UserX}
            iconColor="#ef4444"
            loading={ordersLoading}
            skH={200}
            className={styles.cardEq}
          >
            {terminatedEmployees.length ? (
              <div className={styles.orderList}>
                {terminatedEmployees.map((o) => (
                  <div key={o.id} className={styles.orderItem}>
                    <div
                      className={styles.orderAvatar}
                      style={{
                        background: "linear-gradient(135deg,#ef4444,#dc2626)",
                      }}
                    >
                      <span>
                        {(
                          [o.employee?.last_name, o.employee?.first_name]
                            .filter(Boolean)
                            .join(" ") || ""
                        )
                          .trim()
                          .split(/\s+/)
                          .map((w) => w[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase() || "?"}
                      </span>
                    </div>
                    <div className={styles.orderInfo}>
                      <span className={styles.orderName}>
                        {[
                          o.employee?.last_name,
                          o.employee?.first_name,
                          o.employee?.middle_name,
                          o.employee?.id,
                        ]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </span>
                      <span className={styles.orderDate}>
                        {fmtDateShort(o.date)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Empty text={t("noData")} />
            )}
          </Card>
        </motion.div>

        {/* Branch pie + Employees by position — equal heights */}
        {showBranchWidgets && (
          <motion.div
            className={styles.row2Eq}
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.05 }}
          >
            <Card
              title={t("dashboard.employeesByBranch")}
              icon={Building2}
              iconColor="#06b6d4"
              loading={anaLoading}
              skH={220}
              className={styles.cardEq}
            >
              {analytics?.employeesByBranch?.length ? (
                <div className={styles.pieWrap}>
                  <ResponsiveContainer width={180} height={180}>
                    <PieChart>
                      <Pie
                        data={analytics.employeesByBranch}
                        dataKey="count"
                        nameKey="branch"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={72}
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        {analytics.employeesByBranch.map((_, i) => (
                          <Cell
                            key={i}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid var(--border-color)",
                          background: "var(--card-bg)",
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <PieLegend
                    data={analytics.employeesByBranch}
                    nameKey="branch"
                    t={t}
                  />
                </div>
              ) : (
                <Empty text={t("noData")} />
              )}
            </Card>

            <Card
              title={t("dashboard.employeesByPosition")}
              icon={Briefcase}
              iconColor="#a855f7"
              loading={anaLoading}
              skH={220}
              className={styles.cardEq}
            >
              {analytics?.employeesByPosition?.length ? (
                (() => {
                  const positions = analytics.employeesByPosition.slice(0, 20);
                  const use2Col = positions.length > 10;
                  const col1 = positions.slice(0, 10);
                  const col2 = positions.slice(10);
                  return use2Col ? (
                    <div className={styles.hbarList2Col}>
                      <div className={styles.hbarList}>
                        {col1.map((item, i) => (
                          <HBar
                            key={i}
                            label={item.position}
                            count={item.count}
                            max={positionMax}
                            color="linear-gradient(90deg,#a855f7,#8b5cf6)"
                            delay={i * 0.06}
                          />
                        ))}
                      </div>
                      <div className={styles.hbarList}>
                        {col2.map((item, i) => (
                          <HBar
                            key={i + 10}
                            label={item.position}
                            count={item.count}
                            max={positionMax}
                            color="linear-gradient(90deg,#a855f7,#8b5cf6)"
                            delay={(i + 10) * 0.06}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className={styles.hbarList}>
                      {positions.map((item, i) => (
                        <HBar
                          key={i}
                          label={item.position}
                          count={item.count}
                          max={positionMax}
                          color="linear-gradient(90deg,#a855f7,#8b5cf6)"
                          delay={i * 0.06}
                        />
                      ))}
                    </div>
                  );
                })()
              ) : (
                <Empty text={t("noData")} />
              )}
            </Card>
          </motion.div>
        )}

        {/* Employees by position — single branch users */}
        {!showBranchWidgets && analytics?.employeesByPosition?.length > 0 && (
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.05 }}
          >
            <Card
              title={t("dashboard.employeesByPosition")}
              icon={Briefcase}
              iconColor="#a855f7"
              loading={anaLoading}
              skH={180}
            >
              {(() => {
                const positions = analytics.employeesByPosition.slice(0, 20);
                const use2Col = positions.length > 10;
                const col1 = positions.slice(0, 10);
                const col2 = positions.slice(10);
                return use2Col ? (
                  <div className={styles.hbarList2Col}>
                    <div className={styles.hbarList}>
                      {col1.map((item, i) => (
                        <HBar
                          key={i}
                          label={item.position}
                          count={item.count}
                          max={positionMax}
                          color="linear-gradient(90deg,#a855f7,#8b5cf6)"
                          delay={i * 0.06}
                        />
                      ))}
                    </div>
                    <div className={styles.hbarList}>
                      {col2.map((item, i) => (
                        <HBar
                          key={i + 10}
                          label={item.position}
                          count={item.count}
                          max={positionMax}
                          color="linear-gradient(90deg,#a855f7,#8b5cf6)"
                          delay={(i + 10) * 0.06}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className={styles.hbarList}>
                    {positions.map((item, i) => (
                      <HBar
                        key={i}
                        label={item.position}
                        count={item.count}
                        max={positionMax}
                        color="linear-gradient(90deg,#a855f7,#8b5cf6)"
                        delay={i * 0.06}
                      />
                    ))}
                  </div>
                );
              })()}
            </Card>
          </motion.div>
        )}
      </DashboardSection>

      {/* ══════════════════════════════════════════════════════════
          SECTION 3: ФИНАНСЫ
      ══════════════════════════════════════════════════════════ */}
      <DashboardSection
        title={t("dashboard.sectionFinance")}
        icon={Wallet}
        iconColor="#f59e0b"
      >
        {/* Finance placeholder widgets — full width */}
        <motion.div
          className={styles.gridFull}
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.05 }}
        >
          {FINANCE_MOCK.map((w, i) => (
            <MockCard
              key={i}
              icon={w.icon}
              color={w.color}
              label={t(`dashboard.${w.labelKey}`)}
              value={w.value}
              sub={w.sub}
            />
          ))}
        </motion.div>

        {/* Payments + advances + salary — one row, equal heights */}
        <motion.div
          className={styles.row3Eq}
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.05 }}
        >
          <PlaceholderCard
            title={t("dashboard.recentPayments")}
            icon={CreditCard}
            iconColor="#10b981"
            t={t}
          />
          <PlaceholderCard
            title={t("dashboard.recentAdvances")}
            icon={DollarSign}
            iconColor="#f59e0b"
            t={t}
          />
          <PlaceholderCard
            title={t("dashboard.salaryByDept")}
            icon={TrendingUp}
            iconColor="#3b82f6"
            t={t}
          />
        </motion.div>
      </DashboardSection>

      {/* ══════════════════════════════════════════════════════════
          SECTION 4: ЗАДАЧИ
      ══════════════════════════════════════════════════════════ */}
      <DashboardSection
        title={t("dashboard.sectionTasks")}
        icon={CheckSquare}
        iconColor="#8b5cf6"
      >
        {/* Tasks placeholder widgets — full width */}
        <motion.div
          className={styles.gridFull}
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.05 }}
        >
          {TASKS_MOCK.map((w, i) => (
            <MockCard
              key={i}
              icon={w.icon}
              color={w.color}
              label={t(`dashboard.${w.labelKey}`)}
              value={w.value}
              sub={w.sub}
            />
          ))}
        </motion.div>

        {/* Recent tasks + tasks chart + deadlines */}
        <motion.div
          className={styles.row3}
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.05 }}
        >
          <PlaceholderCard
            title={t("dashboard.recentTasks")}
            icon={CheckSquare}
            iconColor="#6366f1"
            t={t}
          />
          <PlaceholderCard
            title={t("dashboard.tasksByStatus")}
            icon={TrendingUp}
            iconColor="#8b5cf6"
            t={t}
          />
          <PlaceholderCard
            title={t("dashboard.upcomingDeadlines")}
            icon={Timer}
            iconColor="#ef4444"
            t={t}
          />
        </motion.div>
      </DashboardSection>

      {/* ══════════════════════════════════════════════════════════
          SECTION 5: АКТИВНОСТЬ — hidden if no vehicle access
      ══════════════════════════════════════════════════════════ */}
      {hasVehicleAccess && (
        <DashboardSection
          title={t("dashboard.sectionActivity")}
          icon={Car}
          iconColor="#3b82f6"
        >
          {/* Door traffic chart + vehicle passes feed — one row */}
          <motion.div
            className={styles.row2Eq}
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.05 }}
          >
            <Card
              title={t("dashboard.doorTraffic")}
              icon={Clock}
              iconColor="#f59e0b"
              loading={anaLoading}
              skH={240}
              className={styles.cardEq}
            >
              {analytics?.doorTrafficByHour?.some(
                (h) => h.entry > 0 || h.exit > 0,
              ) ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={analytics.doorTrafficByHour}
                    margin={{ left: -10, right: 8 }}
                    barGap={1}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border-color)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="hour"
                      tick={{
                        fontSize: 9.5,
                        fill: "var(--text-color)",
                        opacity: 0.6,
                      }}
                      axisLine={false}
                      tickLine={false}
                      interval={2}
                    />
                    <YAxis
                      tick={{
                        fontSize: 11,
                        fill: "var(--text-color)",
                        opacity: 0.6,
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 11 }}
                    />
                    <Bar
                      dataKey="entry"
                      name={t("entry")}
                      fill="#6366f1"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={18}
                    />
                    <Bar
                      dataKey="exit"
                      name={t("exit")}
                      fill="#f59e0b"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={18}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty text={t("noData")} />
              )}
            </Card>

            <Card
              title={t("dashboard.recentVehiclePasses")}
              icon={Car}
              iconColor="#3b82f6"
              loading={feedLoading}
              skH={240}
              className={styles.cardEq}
            >
              {feeds?.recentVehiclePasses?.length ? (
                <div className={styles.feedList}>
                  {feeds.recentVehiclePasses.slice(0, 5).map((v) => (
                    <PassItem key={v.id} item={v} t={t} isVehicle={true} />
                  ))}
                </div>
              ) : (
                <Empty text={t("noData")} />
              )}
            </Card>
          </motion.div>
        </DashboardSection>
      )}
      <div style={{ height: 48, flexShrink: 0 }} />
    </div>
  );
};

export default HomePage;
