import { useState } from "react";
import { useTranslation } from "react-i18next";

import { IconAlarm, IconArrowRight, IconChevronDown, IconClock } from "./tg/tgIcons";
import { formatDate, formatMinutes, initialOf, toneStyle } from "../utils/attendanceTelegram";
import { hhmm } from "../utils/lateTelegram";

import periodStyles from "./AttendancePeriodTelegram.module.scss";
import styles from "./LateDaysTelegram.module.scss";

const MiniAvatar = ({ row }) => {
  const [failed, setFailed] = useState(false);

  return (
    <span className={styles.avatar}>
      {row.photo && !failed ? (
        <img
          src={`/api/employees/image/${row.photo}`}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span>{initialOf(row.fullName)}</span>
      )}
    </span>
  );
};

const EmployeeRow = ({ row, t }) => (
  <li className={styles.employee}>
    <MiniAvatar row={row} />

    <span className={styles.employeeMain}>
      <span className={styles.employeeName}>{row.fullName || "—"}</span>
      <span className={styles.employeeSub}>
        {row.scheduled && (
          <>
            <span className={styles.planned}>{row.scheduled}</span>
            <IconArrowRight />
          </>
        )}
        <b>{row.actual || "—"}</b>
        {row.department && <span className={styles.dept}>· {row.department}</span>}
      </span>
    </span>

    <span className={styles.employeePill} style={toneStyle(row.late > 30 ? "red" : "amber")}>
      +{formatMinutes(row.late || row.breakLate, t)}
    </span>
  </li>
);

const DayCard = ({ day, showBranches, language, t }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className={periodStyles.day}>
      <button
        type="button"
        className={periodStyles.dayHead}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={periodStyles.badge}>
          <small>{formatDate(day.date, language, { weekday: "short" })}</small>
          <b>{formatDate(day.date, language, { day: "numeric" })}</b>
        </span>

        <span className={periodStyles.dayMain}>
          <span className={periodStyles.dayTitle}>
            {formatDate(day.date, language, { day: "numeric", month: "long" })}
          </span>

          <span className={periodStyles.chips}>
            <span className={periodStyles.chip} style={toneStyle("amber")}>
              <IconAlarm />
              {t("lateTg.peopleCount", { count: day.count })}
            </span>
            <span className={periodStyles.chip} style={toneStyle("red")}>
              <IconClock />
              {hhmm(day.minutes)}
            </span>
          </span>
        </span>

        <span className={`${periodStyles.dayChevron} ${open ? periodStyles.dayChevronOpen : ""}`}>
          <IconChevronDown />
        </span>
      </button>

      {open && (
        <div className={periodStyles.dayBody}>
          {day.branches.map((branch) => (
            <div key={branch.name} className={styles.branch}>
              {showBranches && (
                <span className={styles.branchHead}>
                  <b>{branch.name}</b>
                  <span>{branch.count}</span>
                </span>
              )}

              <ul className={styles.employees}>
                {branch.employees.map((row) => (
                  <EmployeeRow key={row.key} row={row} t={t} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Период по дням: новые сверху, у каждого дня — сколько человек опоздало и на сколько,
// по тапу раскрываются филиалы и сами опоздавшие.
const LateDaysTelegram = ({ days = [], showBranches = true }) => {
  const { t, i18n } = useTranslation();

  if (days.length === 0) {
    return (
      <div className={periodStyles.empty}>
        <span className={periodStyles.emptyIcon}>
          <IconAlarm />
        </span>
        <p>{t("lateTg.empty")}</p>
      </div>
    );
  }

  return (
    <div className={periodStyles.list}>
      {days.map((day) => (
        <DayCard
          key={day.date}
          day={day}
          showBranches={showBranches}
          language={i18n.language}
          t={t}
        />
      ))}
    </div>
  );
};

export default LateDaysTelegram;
