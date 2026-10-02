import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { IconCalendar, IconChevronDown, IconClock, IconSun, IconUserOff } from "./tg/tgIcons";
import { formatDate, percent, toneStyle } from "../utils/attendanceTelegram";

import styles from "./AttendancePeriodTelegram.module.scss";

const RateText = ({ rate }) => (rate == null ? "—" : `${rate}%`);

// Красные / жёлтые / бирюзовые счётчики дня; нулевые не показываем
const Chips = ({ counts }) => {
  const items = [
    { key: "absent", tone: "red", icon: <IconUserOff />, value: counts.absent },
    { key: "late", tone: "amber", icon: <IconClock />, value: counts.late },
    { key: "timeOff", tone: "teal", icon: <IconSun />, value: counts.onTimeOff },
  ].filter((item) => item.value > 0);

  if (items.length === 0) return null;

  return (
    <span className={styles.chips}>
      {items.map((item) => (
        <span key={item.key} className={styles.chip} style={toneStyle(item.tone)}>
          {item.icon}
          {item.value}
        </span>
      ))}
    </span>
  );
};

const Bar = ({ counts }) => {
  const segments = [
    { tone: "green", value: counts.present },
    { tone: "teal", value: counts.onTimeOff },
    { tone: "red", value: counts.absent },
  ].filter((seg) => seg.value > 0);

  return (
    <span className={styles.bar} aria-hidden="true">
      {segments.map((seg) => (
        <span
          key={seg.tone}
          className={styles.barSegment}
          style={{ ...toneStyle(seg.tone), flexGrow: seg.value }}
        />
      ))}
    </span>
  );
};

// Строка филиала / отдела внутри дня. Филиал раскрывается до отделов.
const BreakdownRow = ({ row, depth, open, onToggle }) => {
  const expandable = row.departments?.length > 0;
  const rate = percent(row.present, row.scheduledEmployees);

  const content = (
    <>
      <span className={styles.rowMain}>
        <span className={styles.rowName}>{row.displayName}</span>
        <Chips counts={row} />
      </span>

      <span className={styles.rowNumbers}>
        <b>
          {row.present}/{row.scheduledEmployees}
        </b>
        <span>
          <RateText rate={rate} />
        </span>
      </span>

      {expandable && (
        <span className={`${styles.rowChevron} ${open ? styles.rowChevronOpen : ""}`}>
          <IconChevronDown />
        </span>
      )}
    </>
  );

  const className = `${styles.row} ${depth ? styles.rowNested : ""}`;

  return expandable ? (
    <button type="button" className={className} aria-expanded={open} onClick={onToggle}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
};

const DayCard = ({ day, isBranchMode, language, t }) => {
  const [open, setOpen] = useState(false);
  const [openBranches, setOpenBranches] = useState({});

  const dayOff = !day.scheduledEmployees;
  const rate = percent(day.present, day.scheduledEmployees);

  const rows = useMemo(() => {
    const named = (list, fallbackKey) =>
      list.map((item) => ({
        ...item,
        displayName: item.name || t(fallbackKey),
      }));

    if (isBranchMode) {
      return named(
        (day.branches || []).flatMap((branch) => branch.departments || []),
        "noDepartment",
      );
    }

    return named(day.branches || [], "noBranch").map((branch) => ({
      ...branch,
      departments: named(branch.departments || [], "noDepartment"),
    }));
  }, [day, isBranchMode, t]);

  return (
    <div className={`${styles.day} ${dayOff ? styles.dayOff : ""}`}>
      <button
        type="button"
        className={styles.dayHead}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={styles.badge}>
          <small>{formatDate(day.date, language, { weekday: "short" })}</small>
          <b>{formatDate(day.date, language, { day: "numeric" })}</b>
        </span>

        <span className={styles.dayMain}>
          <span className={styles.dayTitle}>
            {formatDate(day.date, language, { day: "numeric", month: "long" })}
          </span>

          <span className={styles.daySub}>
            {dayOff
              ? t("attendanceTg.dayOff")
              : t("attendanceTg.presentOf", {
                  present: day.present,
                  total: day.scheduledEmployees,
                })}
          </span>

          {!dayOff && <Bar counts={day} />}
          <Chips counts={day} />
        </span>

        <span className={styles.dayRate}>
          <RateText rate={rate} />
        </span>

        <span className={`${styles.dayChevron} ${open ? styles.dayChevronOpen : ""}`}>
          <IconChevronDown />
        </span>
      </button>

      {open && (
        <div className={styles.dayBody}>
          {rows.length === 0 ? (
            <p className={styles.dayEmpty}>{t("noData")}</p>
          ) : (
            rows.map((row) => (
              <div key={row.displayName}>
                <BreakdownRow
                  row={row}
                  depth={0}
                  open={Boolean(openBranches[row.displayName])}
                  onToggle={() =>
                    setOpenBranches((prev) => ({
                      ...prev,
                      [row.displayName]: !prev[row.displayName],
                    }))
                  }
                />

                {openBranches[row.displayName] &&
                  row.departments.map((dept) => (
                    <BreakdownRow key={dept.displayName} row={dept} depth={1} />
                  ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// Период по дням: новые сверху, у каждого дня — явка и раскрытие до филиалов и отделов.
const AttendancePeriodTelegram = ({ days = [], isBranchMode = false }) => {
  const { t, i18n } = useTranslation();

  const ordered = useMemo(() => [...days].reverse(), [days]);

  if (ordered.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>
          <IconCalendar />
        </span>
        <p>{t("noData")}</p>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {ordered.map((day) => (
        <DayCard
          key={day.date}
          day={day}
          isBranchMode={isBranchMode}
          language={i18n.language}
          t={t}
        />
      ))}
    </div>
  );
};

export default AttendancePeriodTelegram;
