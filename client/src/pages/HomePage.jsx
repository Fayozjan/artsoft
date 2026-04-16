import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  LayoutGrid,
  LogIn,
  LogOut,
  CalendarOff,
  Car,
  TrendingUp,
  Clock,
  Gift,
  ChevronDown,
  ChevronUp,
  MapPin,
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
import styles from "./HomePage.module.scss";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const PIE_COLORS = [
  "#6366f1","#06b6d4","#10b981","#f59e0b",
  "#ef4444","#8b5cf6","#22c55e","#3b82f6",
  "#ec4899","#14b8a6","#f97316","#a855f7",
];

const STAT_DEFS = [
  { key: "totalBranches",     icon: Building2,  gradient: "linear-gradient(135deg,#6366f1,#8b5cf6)", bg: "rgba(99,102,241,0.1)",  stroke: "#6366f1" },
  { key: "totalDepartments",  icon: LayoutGrid, gradient: "linear-gradient(135deg,#06b6d4,#3b82f6)", bg: "rgba(6,182,212,0.1)",   stroke: "#06b6d4" },
  { key: "totalEmployees",    icon: Users,      gradient: "linear-gradient(135deg,#10b981,#059669)", bg: "rgba(16,185,129,0.1)",  stroke: "#10b981" },
  { key: "checkedInToday",    icon: LogIn,      gradient: "linear-gradient(135deg,#22c55e,#16a34a)", bg: "rgba(34,197,94,0.1)",   stroke: "#22c55e" },
  { key: "checkedOutToday",   icon: LogOut,     gradient: "linear-gradient(135deg,#f59e0b,#d97706)", bg: "rgba(245,158,11,0.1)",  stroke: "#f59e0b" },
  { key: "timeOffToday",      icon: CalendarOff,gradient: "linear-gradient(135deg,#ef4444,#dc2626)", bg: "rgba(239,68,68,0.1)",   stroke: "#ef4444" },
  { key: "vehiclePassesToday",icon: Car,        gradient: "linear-gradient(135deg,#3b82f6,#1d4ed8)", bg: "rgba(59,130,246,0.1)",  stroke: "#3b82f6" },
];

// ─── Animated counter ──────────────────────────────────────────────────────────
function useCountUp(target, duration = 900) {
  const [val, setVal] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    if (target == null || target === 0) { setVal(0); return; }
    const startTime = performance.now();
    const animate = (now) => {
      const p = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(eased * target));
      if (p < 1) raf.current = requestAnimationFrame(animate);
    };
    raf.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
}

// ─── Motion variants ───────────────────────────────────────────────────────────
const fadeUp   = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.25, 0.46, 0.45, 0.94] } } };
const stagger  = { hidden: {}, show: { transition: { staggerChildren: 0.055 } } };
const rowFade  = { hidden: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.48, ease: "easeOut" } } };

// ─── Skeleton ──────────────────────────────────────────────────────────────────
const Sk = ({ h = 80, w = "100%", r = 10 }) => (
  <div className={styles.skeleton} style={{ height: h, width: w, borderRadius: r }} />
);

// ─── Stat card ─────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, gradient, bg, stroke, loading }) => {
  const animated = useCountUp(loading ? null : (value ?? 0));
  return (
    <motion.div variants={fadeUp} className={styles.statCard} whileHover={{ y: -4, transition: { duration: 0.18 } }}>
      <div className={styles.statAccent} style={{ background: gradient }} />
      <div className={styles.statBody}>
        <div className={styles.statIconWrap} style={{ background: bg }}>
          <Icon size={20} color={stroke} strokeWidth={2} />
        </div>
        <div className={styles.statContent}>
          <span className={styles.statLabel}>{label}</span>
          <span className={styles.statValue} style={{ color: stroke }}>
            {loading ? <Sk h={26} w={52} r={6} /> : (value != null ? animated : "—")}
          </span>
        </div>
      </div>
      <div className={styles.statBg} style={{ background: gradient }} />
    </motion.div>
  );
};

// ─── Card wrapper ──────────────────────────────────────────────────────────────
const Card = ({ title, icon: Icon, iconColor, children, loading, skH = 240, className = "" }) => (
  <motion.div variants={rowFade} className={`${styles.card} ${className}`}>
    <div className={styles.cardHeader}>
      <div className={styles.cardTitleRow}>
        {Icon && (
          <span className={styles.cardIconWrap} style={{ background: iconColor + "15", color: iconColor }}>
            <Icon size={15} strokeWidth={2.2} />
          </span>
        )}
        <h3 className={styles.cardTitle}>{title}</h3>
      </div>
    </div>
    <div className={styles.cardBody}>
      {loading ? <Sk h={skH} /> : children}
    </div>
  </motion.div>
);

// ─── Empty state ───────────────────────────────────────────────────────────────
const Empty = ({ text }) => (
  <div className={styles.empty}><span className={styles.emptyDot} />{text}</div>
);

// ─── Custom tooltip ────────────────────────────────────────────────────────────
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

// ─── Horizontal bar row ────────────────────────────────────────────────────────
const HBar = ({ label, count, max, color = "linear-gradient(90deg,#6366f1,#8b5cf6)", delay = 0 }) => (
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

// ─── Feed helpers ──────────────────────────────────────────────────────────────
const fmtDateTime = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
};
const fmtDateShort = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
};
const initials = (e) => ((e?.first_name?.[0] || "") + (e?.last_name?.[0] || "")).toUpperCase() || "?";
const fullName  = (e) => [e?.last_name, e?.first_name].filter(Boolean).join(" ") || "—";

// ─── Pass feed item ────────────────────────────────────────────────────────────
const PassItem = ({ item, t, isVehicle }) => {
  const isEntry = item.direction === "entry";
  const imgSrc = isVehicle
    ? (item.photo ? `/api/vehicle-passes/image/${item.photo}` : null)
    : (item.photo ? `/api/face-passes/image/${item.photo}` : item.employee?.photo ? `/api/employees/image/${item.employee.photo}` : null);

  return (
    <div className={styles.feedItem}>
      <div className={`${styles.feedAvatar} ${isVehicle ? styles.feedAvatarCar : ""}`}
           style={isVehicle ? {} : { background: isEntry ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "linear-gradient(135deg,#f59e0b,#d97706)" }}>
        {imgSrc
          ? <img src={imgSrc} alt="" />
          : isVehicle
            ? <Car size={16} strokeWidth={1.5} />
            : <span className={styles.feedInitials}>{initials(item.employee)}</span>
        }
      </div>
      <div className={styles.feedInfo}>
        <span className={styles.feedName}>{isVehicle ? (item.plate_number || "—") : fullName(item.employee)}</span>
        <span className={styles.feedSub}>{isVehicle ? (item.gate?.name || "—") : (item.door?.name || "—")}</span>
      </div>
      <div className={styles.feedRight}>
        <span className={styles.feedDateTime}>{fmtDateTime(item.date)}</span>
        <span className={isEntry ? styles.badgeEntry : styles.badgeExit}>
          {isEntry ? t("entry") : t("exit")}
        </span>
      </div>
    </div>
  );
};

// ─── Time-off item ─────────────────────────────────────────────────────────────
const TimeOffItem = ({ item, t }) => (
  <div className={styles.feedItem}>
    <div className={styles.feedAvatar} style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)" }}>
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

// ─── Birthday item ─────────────────────────────────────────────────────────────
const BirthdayItem = ({ item }) => {
  const isToday = item.daysLeft === 0;
  return (
    <div className={`${styles.bdayItem} ${isToday ? styles.bdayToday : ""}`}>
      <div className={styles.bdayAvatar}>
        {item.photo
          ? <img src={`/api/employees/image/${item.photo}`} alt="" />
          : <span>{initials(item)}</span>
        }
        {isToday && <span className={styles.bdayCrown}>🎂</span>}
      </div>
      <div className={styles.bdayInfo}>
        <span className={styles.bdayName}>{fullName(item)}</span>
        <span className={styles.bdayDept}>{item.department?.name}</span>
      </div>
      <div className={styles.bdayRight}>
        <span className={styles.bdayDate}>
          {new Date(item.date_of_birth).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
        </span>
        {isToday
          ? <span className={styles.bdayTodayBadge}>Сегодня 🎉</span>
          : <span className={styles.bdayDays}>через {item.daysLeft} дн.</span>
        }
      </div>
    </div>
  );
};

// ─── Pie legend with expand ────────────────────────────────────────────────────
const PieLegend = ({ data, t }) => {
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 5;
  const visible = expanded ? data : data.slice(0, LIMIT);
  const hasMore = data.length > LIMIT;

  return (
    <div className={styles.pieLegendWrap}>
      <ul className={styles.pieLegend}>
        {visible.map((item, i) => (
          <li key={i}>
            <span className={styles.pieDot} style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
            <span className={styles.pieName}>{item.branch}</span>
            <span className={styles.pieCount}>{item.count}</span>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button className={styles.expandBtn} onClick={() => setExpanded((v) => !v)}>
          {expanded
            ? <><ChevronUp size={13} /> {t("dashboard.showLess")}</>
            : <><ChevronDown size={13} /> {t("dashboard.showMore")} ({data.length - LIMIT})</>
          }
        </button>
      )}
    </div>
  );
};

// ─── MAIN ──────────────────────────────────────────────────────────────────────
const HomePage = () => {
  const { t } = useTranslation();
  const [summary,   setSummary]   = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [feeds,     setFeeds]     = useState(null);
  const [sumLoading, setSumLoading]   = useState(true);
  const [anaLoading, setAnaLoading]   = useState(true);
  const [feedLoading,setFeedLoading]  = useState(true);

  useEffect(() => {
    getDashboardSummary().then(setSummary).catch(console.error).finally(() => setSumLoading(false));
  }, []);

  useEffect(() => {
    getDashboardAnalytics().then(setAnalytics).catch(console.error).finally(() => setAnaLoading(false));
    getDashboardFeeds().then(setFeeds).catch(console.error).finally(() => setFeedLoading(false));
  }, []);

  const deptMax   = analytics?.topDepartments?.[0]?.count  ?? 1;
  const branchMax = analytics?.branchActivity?.[0]?.count  ?? 1;

  return (
    <div className={styles.page}>

      {/* ── 1. Stat cards ─────────────────────────────── */}
      <motion.div className={styles.statGrid} variants={stagger} initial="hidden" animate="show">
        {STAT_DEFS.map(({ key, icon, gradient, bg, stroke }) => (
          <StatCard
            key={key}
            icon={icon}
            label={t(`dashboard.${key}`)}
            value={summary?.[key]}
            gradient={gradient}
            bg={bg}
            stroke={stroke}
            loading={sumLoading}
          />
        ))}
      </motion.div>

      {/* ── 2. Weekly attendance (full width) ─────────── */}
      <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}>
        <Card title={t("dashboard.weeklyAttendance")} icon={TrendingUp} iconColor="#6366f1" loading={anaLoading} skH={220}>
          {analytics?.weeklyAttendance?.length ? (
            <ResponsiveContainer width="100%" height={210}>
              <LineChart data={analytics.weeklyAttendance} margin={{ left: -10, right: 20 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11.5, fill: "var(--text-color)", opacity: 0.6 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-color)", opacity: 0.6 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="count" name={t("dashboard.employees")} stroke="#6366f1" strokeWidth={2.5}
                  dot={{ r: 4, fill: "#6366f1", stroke: "var(--card-bg)", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "#6366f1", stroke: "var(--card-bg)", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : <Empty text={t("noData")} />}
        </Card>
      </motion.div>

      {/* ── 3. Hiring | Door traffic | Dept activity ──── */}
      <motion.div className={styles.row3} variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}>

        <Card title={t("dashboard.hiringDynamics")} icon={Users} iconColor="#10b981" loading={anaLoading} skH={210}>
          {analytics?.hiringDynamics?.length ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics.hiringDynamics} margin={{ left: -10, right: 8 }} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--text-color)", opacity: 0.6 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-color)", opacity: 0.6 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="hired"      name={t("dashboard.hired")}      fill="#10b981" radius={[4,4,0,0]} maxBarSize={24} />
                <Bar dataKey="terminated" name={t("dashboard.terminated")} fill="#ef4444" radius={[4,4,0,0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty text={t("noData")} />}
        </Card>

        <Card title={t("dashboard.doorTraffic")} icon={Clock} iconColor="#f59e0b" loading={anaLoading} skH={210}>
          {analytics?.doorTrafficByHour?.some(h => h.entry > 0 || h.exit > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics.doorTrafficByHour} margin={{ left: -10, right: 8 }} barGap={1}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 9.5, fill: "var(--text-color)", opacity: 0.6 }} axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-color)", opacity: 0.6 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="entry" name={t("entry")} fill="#6366f1" radius={[3,3,0,0]} maxBarSize={18} />
                <Bar dataKey="exit"  name={t("exit")}  fill="#f59e0b" radius={[3,3,0,0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          ) : <Empty text={t("noData")} />}
        </Card>

        <Card title={t("dashboard.topDepartments")} icon={LayoutGrid} iconColor="#8b5cf6" loading={anaLoading} skH={210}>
          {analytics?.topDepartments?.length ? (
            <div className={styles.hbarList}>
              {analytics.topDepartments.map((item, i) => (
                <HBar key={i} label={item.department} count={item.count} max={deptMax}
                      color="linear-gradient(90deg,#6366f1,#8b5cf6)" delay={i * 0.06} />
              ))}
            </div>
          ) : <Empty text={t("noData")} />}
        </Card>

      </motion.div>

      {/* ── 4. Branch pie | Branch activity ───────────── */}
      <motion.div className={styles.row2} variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }}>

        <Card title={t("dashboard.employeesByBranch")} icon={Building2} iconColor="#06b6d4" loading={anaLoading} skH={220}>
          {analytics?.employeesByBranch?.length ? (
            <div className={styles.pieWrap}>
              <ResponsiveContainer width={200} height={180}>
                <PieChart>
                  <Pie data={analytics.employeesByBranch} dataKey="count" nameKey="branch"
                       cx="50%" cy="50%" innerRadius={42} outerRadius={78} paddingAngle={3} strokeWidth={0}>
                    {analytics.employeesByBranch.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--card-bg)", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <PieLegend data={analytics.employeesByBranch} t={t} />
            </div>
          ) : <Empty text={t("noData")} />}
        </Card>

        <Card title={t("dashboard.branchActivity")} icon={MapPin} iconColor="#f97316" loading={anaLoading} skH={220}>
          {analytics?.branchActivity?.length ? (
            <div className={styles.hbarList}>
              {analytics.branchActivity.map((item, i) => (
                <HBar key={i} label={item.branch} count={item.count} max={branchMax}
                      color="linear-gradient(90deg,#f97316,#f59e0b)" delay={i * 0.07} />
              ))}
            </div>
          ) : <Empty text={t("noData")} />}
        </Card>

      </motion.div>

      {/* ── 5. Face passes | Vehicle passes ───────────── */}
      <motion.div className={styles.row2} variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.05 }}>

        <Card title={t("dashboard.recentFacePasses")} icon={LogIn} iconColor="#6366f1" loading={feedLoading} skH={300}>
          {feeds?.recentFacePasses?.length ? (
            <div className={styles.feedList}>
              {feeds.recentFacePasses.map(p => <PassItem key={p.id} item={p} t={t} isVehicle={false} />)}
            </div>
          ) : <Empty text={t("noData")} />}
        </Card>

        <Card title={t("dashboard.recentVehiclePasses")} icon={Car} iconColor="#3b82f6" loading={feedLoading} skH={300}>
          {feeds?.recentVehiclePasses?.length ? (
            <div className={styles.feedList}>
              {feeds.recentVehiclePasses.map(v => <PassItem key={v.id} item={v} t={t} isVehicle={true} />)}
            </div>
          ) : <Empty text={t("noData")} />}
        </Card>

      </motion.div>

      {/* ── 6. Time-off | Birthdays ───────────────────── */}
      <motion.div className={styles.row2} variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.05 }}>

        <Card title={t("dashboard.recentTimeOffs")} icon={CalendarOff} iconColor="#ef4444" loading={feedLoading} skH={240}>
          {feeds?.recentTimeOffs?.length ? (
            <div className={styles.feedList}>
              {feeds.recentTimeOffs.map(item => <TimeOffItem key={item.id} item={item} t={t} />)}
            </div>
          ) : <Empty text={t("noData")} />}
        </Card>

        <Card title={t("dashboard.upcomingBirthdays")} icon={Gift} iconColor="#ec4899" loading={feedLoading} skH={240}>
          {feeds?.upcomingBirthdays?.length ? (
            <div className={styles.bdayList}>
              {feeds.upcomingBirthdays.map(e => <BirthdayItem key={e.id} item={e} />)}
            </div>
          ) : <Empty text={t("noData")} />}
        </Card>

      </motion.div>

    </div>
  );
};

export default HomePage;
