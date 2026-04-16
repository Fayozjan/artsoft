import { formatIsoToLocalDate, formatIsoToLocalDateTime } from "../utils/date";
import styles from "./LateMonitoringCard.module.scss";

const formatLateTime = (minutes) => {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
};

const ShieldIcon = () => (
  <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
    <path
      stroke="#c49000"
      strokeWidth="2.5"
      d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
    />
  </svg>
);

const CalendarIcon = () => (
  <svg width="11" height="11" fill="none" viewBox="0 0 24 24">
    <rect
      x="3"
      y="4"
      width="18"
      height="18"
      rx="3"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M16 2v4M8 2v4M3 10h18"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const LateMonitoringCard = ({ item, index = 0, includeLunch }) => {
  return (
    <div className={styles.card} style={{ animationDelay: `${index * 0.08}s` }}>
      <div
        className={`${styles.badge} ${item.monthlyLateCount >= 10 ? styles.badgeBig : ""}`}
      >
        {item.monthlyArrivalLateCount + item.monthlyLunchLateCount}
      </div>

      {item.date && (
        <div className={styles.dateChip}>
          <CalendarIcon />
          <span>{formatIsoToLocalDate(item.date)}</span>
        </div>
      )}

      <div className={styles.top}>
        <img
          className={styles.avatar}
          src={`/api/face-passes/image/${item.actualStartPhoto}`}
          alt={item.employeeFullName}
        />
        <div className={styles.topInfo}>
          <h4 className={styles.name}>{item.employeeFullName}</h4>
          <div className={styles.meta}>
            <div className={styles.metaLabel}>
              Филиал:{" "}
              <span className={styles.metaValue}>{item.branchName}</span>
            </div>

            <div className={styles.metaLabel}>
              Отдел:{" "}
              <span className={styles.metaValue}>{item.departmentName}</span>
            </div>

            <div className={styles.metaLabel}>
              Должность:{" "}
              <span className={styles.metaValue}>{item.positionName}</span>
            </div>
          </div>
        </div>
      </div>

      {item.havePermission && (
        <div className={styles.permissionBanner}>
          <div className={styles.permIcon}>
            <ShieldIcon />
          </div>
          <span className={styles.permText}>Отгул</span>
          <span className={styles.permEnd}>
            до {formatIsoToLocalDateTime(item.permissionEndTime)}
          </span>
        </div>
      )}

      <div className={styles.footer}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>График</span>
          <span className={`${styles.statValue} ${styles.statSched}`}>
            {item.scheduledStart?.substring(0, 5)}
          </span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Вход</span>
          <span className={`${styles.statValue} ${styles.statEntry}`}>
            {item.actualStart}
          </span>
        </div>

        <div className={styles.stat}>
          <span className={styles.statLabel}>Опозд</span>
          <span className={`${styles.statValue} ${styles.statLate}`}>
            {formatLateTime(item.lateMinutes)}
          </span>
        </div>

        {includeLunch && item.breakReturnLateMinutes > 0 && (
          <>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Перерыв по</span>
              <span className={`${styles.statValue} ${styles.statSched}`}>
                {item.scheduledBreakEnd?.substring(0, 5) || "—"}
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Вернулся</span>
              <span className={`${styles.statValue} ${styles.statEntry}`}>
                {item.actualBreakReturn || "—"}
              </span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Опозд перерыв</span>
              <span className={`${styles.statValue} ${styles.statLate}`}>
                {formatLateTime(item.breakReturnLateMinutes)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LateMonitoringCard;
