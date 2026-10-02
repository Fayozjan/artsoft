import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import TgSheet from "./tg/TgSheet";
import {
  IconCalendar,
  IconAlarm,
  IconFlash,
  IconSun,
  IconLogIn,
  IconLogOut,
  IconHash,
  IconMapPin,
  IconBuilding,
  IconBriefcase,
  IconUsers,
} from "./tg/tgIcons";
import { formatMinutesToHours } from "../utils/date";
import {
  toneStyle,
  initialOf,
  percent,
  rateTone,
  daysInMonth,
  leadingBlanks,
  dayStatus,
  DAY_STATUS_TONES,
} from "../utils/timesheetTelegram";

import styles from "./TimesheetEmployeesTelegram.module.scss";

const PAGE_SIZE = 30;

const Avatar = ({ emp, className }) => {
  const [failed, setFailed] = useState(false);
  const showPhoto = emp.employeePhoto && !failed;

  return (
    <span className={className}>
      {showPhoto ? (
        <img
          src={`/api/employees/image/${emp.employeePhoto}`}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={styles.initial}>{initialOf(emp.employeeFullName)}</span>
      )}
    </span>
  );
};

function formatEventTime(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("ru-RU", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const EmployeeCard = ({ emp, onOpen, t }) => {
  const rate = percent(emp.totalWorkedDays, emp.totalScheduledDays);
  const tone = rateTone(rate);

  return (
    <button type="button" className={styles.card} style={toneStyle(tone)} onClick={() => onOpen(emp)}>
      <Avatar emp={emp} className={styles.avatar} />

      <span className={styles.main}>
        <span className={styles.name}>{emp.employeeFullName || "—"}</span>
        <span className={styles.sub}>
          {[emp.positionName, emp.departmentName].filter(Boolean).join(" · ") || "—"}
        </span>

        <span className={styles.chips}>
          <span className={styles.chip}>
            <IconCalendar />
            {emp.totalWorkedDays ?? 0}/{emp.totalScheduledDays ?? 0}
          </span>
          {emp.totalLateCount > 0 && (
            <span className={`${styles.chip} ${styles.chipTone}`} style={toneStyle("amber")}>
              <IconAlarm />+{emp.totalLateCount}
            </span>
          )}
          {emp.totalOvertimeMinutes > 0 && (
            <span className={`${styles.chip} ${styles.chipTone}`} style={toneStyle("teal")}>
              <IconFlash />
              {formatMinutesToHours(emp.totalOvertimeMinutes)}
            </span>
          )}
          {emp.totalPaidTimeOffDays > 0 && (
            <span className={`${styles.chip} ${styles.chipTone}`} style={toneStyle("purple")}>
              <IconSun />
              {emp.totalPaidTimeOffDays}
            </span>
          )}
        </span>
      </span>

      <span className={styles.pill}>{rate == null ? "—" : `${rate}%`}</span>
    </button>
  );
};

const InfoRow = ({ icon, label, value }) =>
  value ? (
    <li className={styles.infoRow}>
      <span className={styles.infoIcon}>{icon}</span>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoValue}>{value}</span>
    </li>
  ) : null;

const LEGEND_KEYS = {
  worked: "attendanceTg.worked",
  absent: "timesheetTg.noRecords",
  dayOff: "attendanceTg.dayOff",
  timeOff: "timesheetTg.dayOffLeave",
};

const EmployeeSheet = ({ emp, month, calendarByDay, weekdayLabels, isOpen, onClose, t }) => {
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    if (isOpen) setSelectedDay(null);
  }, [isOpen, emp]);

  const cells = useMemo(() => {
    if (!emp) return [];
    const total = daysInMonth(month);
    const blanks = Array.from({ length: leadingBlanks(month) }, () => null);
    const days = Array.from({ length: total }, (_, i) => i + 1);
    return [...blanks, ...days];
  }, [emp, month]);

  const rate = emp ? percent(emp.totalWorkedDays, emp.totalScheduledDays) : null;

  const dayKey = selectedDay ? `${month}-${String(selectedDay).padStart(2, "0")}` : null;
  const dayData = dayKey ? emp?.sessions?.[dayKey] : null;

  return (
    <TgSheet
      isOpen={isOpen}
      onClose={onClose}
      title={emp?.employeeFullName || ""}
      subtitle={emp?.positionName || undefined}
    >
      {emp && (
        <div className={styles.sheet}>
          <div className={styles.sheetTop}>
            <Avatar emp={emp} className={styles.sheetAvatar} />
            <span className={styles.ratePill} style={toneStyle(rateTone(rate))}>
              {rate == null ? "—" : `${rate}%`}
            </span>
          </div>

          <div className={styles.stats}>
            <div className={styles.statCell}>
              <span className={styles.statLabel}>{t("workedDays")}</span>
              <b>{emp.totalWorkedDays ?? 0}/{emp.totalScheduledDays ?? 0}</b>
            </div>
            <div className={styles.statCell}>
              <span className={styles.statLabel}>{t("workedHours")}</span>
              <b>{emp.totalWorkedHours || "00:00"}</b>
            </div>
            <div className={styles.statCell}>
              <span className={styles.statLabel}>{t("lateHours")}</span>
              <b>{emp.totalLateCount ?? 0} / {emp.totalLateTime || "00:00"}</b>
            </div>
            <div className={styles.statCell}>
              <span className={styles.statLabel}>{t("overtimeHours")}</span>
              <b>{formatMinutesToHours(emp.totalOvertimeMinutes)}</b>
            </div>
            <div className={styles.statCell}>
              <span className={styles.statLabel}>{t("paidTimeOff")}</span>
              <b>{emp.totalPaidTimeOffDays ?? 0} / {formatMinutesToHours(emp.totalPaidTimeOffMinutes)}</b>
            </div>
          </div>

          <div className={styles.weekdays}>
            {weekdayLabels.map((w, i) => (
              <span key={i}>{w}</span>
            ))}
          </div>

          <div className={styles.calendar}>
            {cells.map((day, i) => {
              if (day == null) return <span key={`b${i}`} className={styles.dayBlank} />;

              const status = dayStatus(day, month, emp, calendarByDay);
              const mark = calendarByDay?.get(day);
              const dKey = `${month}-${String(day).padStart(2, "0")}`;
              const session = emp.sessions?.[dKey];

              return (
                <button
                  key={day}
                  type="button"
                  className={`${styles.day} ${selectedDay === day ? styles.dayActive : ""}`}
                  style={toneStyle(DAY_STATUS_TONES[status])}
                  onClick={() => setSelectedDay((prev) => (prev === day ? null : day))}
                >
                  <span className={styles.dayNum}>{day}</span>
                  {session?.workDuration && status === "worked" && (
                    <span className={styles.dayHours}>{session.workDuration}</span>
                  )}
                  {mark?.day_type === "short" && <span className={styles.dayMark} />}
                </button>
              );
            })}
          </div>

          <div className={styles.legend}>
            {Object.entries(LEGEND_KEYS).map(([key, labelKey]) => (
              <span key={key} className={styles.legendItem} style={toneStyle(DAY_STATUS_TONES[key])}>
                <i />
                {t(labelKey)}
              </span>
            ))}
          </div>

          {selectedDay && (
            <div className={styles.dayDetail}>
              {dayData?.events?.length > 0 ? (
                <ul className={styles.eventList}>
                  {dayData.events.map((ev, i) => (
                    <li key={i} className={styles.eventRow}>
                      <span className={`${styles.eventIcon} ${ev.direction === "entry" ? styles.eventIn : styles.eventOut}`}>
                        {ev.direction === "entry" ? <IconLogIn /> : <IconLogOut />}
                      </span>
                      <span className={styles.eventTime}>{formatEventTime(ev.date)}</span>
                      {ev.doorName && <span className={styles.eventDoor}>{ev.doorName}</span>}
                    </li>
                  ))}
                </ul>
              ) : dayData?.timeOff ? (
                <div className={styles.timeOffCard} style={toneStyle("teal")}>
                  <IconSun />
                  <span>{dayData.timeOff.reason || t(dayData.timeOff.type)}</span>
                </div>
              ) : (
                <p className={styles.emptyDay}>{t("noEventsOrTimeOffs")}</p>
              )}
              {dayData?.workDuration && dayData.events?.length > 0 && (
                <p className={styles.dayDuration}>{dayData.workDuration}</p>
              )}
            </div>
          )}

          <ul className={styles.info}>
            <InfoRow icon={<IconHash />} label={t("pinfl")} value={emp.pinfl} />
            <InfoRow icon={<IconMapPin />} label={t("branch")} value={emp.branchName} />
            <InfoRow icon={<IconBuilding />} label={t("department")} value={emp.departmentName} />
            <InfoRow icon={<IconBriefcase />} label={t("position")} value={emp.positionName} />
          </ul>
        </div>
      )}
    </TgSheet>
  );
};

// Список сотрудников карточками: подгружается порциями, тап открывает шторку
// с календарём месяца и подробностями по дню.
const TimesheetEmployeesTelegram = ({ employees = [], month, calendarByDay, scrollRootRef }) => {
  const { t, i18n } = useTranslation();

  const [visible, setVisible] = useState(PAGE_SIZE);
  const [shown, setShown] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sentinelRef = useRef(null);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [employees]);

  const weekdayLabels = useMemo(() => {
    const locale = { ru: "ru", en: "en", uzLatn: "uz-Latn", uzCyrl: "uz-Cyrl" }[i18n.language] || "ru";
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short" });
    // 2024-01-01 — понедельник, удобная опорная точка
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(2024, 0, 1 + i);
      return fmt.format(d).replace(".", "");
    });
  }, [i18n.language]);

  const hasMore = visible < employees.length;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisible((prev) => prev + PAGE_SIZE);
      },
      { root: scrollRootRef?.current || null, rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, visible, scrollRootRef]);

  const openEmployee = (emp) => {
    setShown(emp);
    setSheetOpen(true);
  };

  if (employees.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>
          <IconUsers />
        </span>
        <p>{t("noData")}</p>
      </div>
    );
  }

  return (
    <>
      <div className={styles.list}>
        {employees.slice(0, visible).map((emp) => (
          <EmployeeCard key={emp.employeeId} emp={emp} onOpen={openEmployee} t={t} />
        ))}

        {hasMore && <span ref={sentinelRef} className={styles.sentinel} />}
      </div>

      <EmployeeSheet
        emp={shown}
        month={month}
        calendarByDay={calendarByDay}
        weekdayLabels={weekdayLabels}
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        t={t}
      />
    </>
  );
};

export default TimesheetEmployeesTelegram;
