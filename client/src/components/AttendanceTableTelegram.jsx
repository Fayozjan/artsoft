import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import TgSheet from "./tg/TgSheet";
import {
  IconLogIn,
  IconLogOut,
  IconClock,
  IconSun,
  IconDoor,
  IconHash,
  IconMapPin,
  IconBuilding,
  IconBriefcase,
  IconUsers,
} from "./tg/tgIcons";
import {
  STATUS_META,
  primaryStatus,
  toneStyle,
  initialOf,
  formatMinutes,
} from "../utils/attendanceTelegram";

import styles from "./AttendanceTableTelegram.module.scss";

const PAGE_SIZE = 40;

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

// Причина отгула: «за счёт компании» — отдельный статус, остальное — «отлучка»
const timeOffText = (info, t) => info?.reason || t("excusedLeave");

const EmployeeCard = ({ emp, isToday, onOpen, t }) => {
  const status = primaryStatus(emp, isToday);

  return (
    <button
      type="button"
      className={styles.card}
      style={toneStyle(STATUS_META[status].tone)}
      onClick={() => onOpen(emp)}
    >
      <Avatar emp={emp} className={styles.avatar} />

      <span className={styles.main}>
        <span className={styles.name}>{emp.employeeFullName || "—"}</span>
        <span className={styles.sub}>
          {[emp.positionName, emp.departmentName].filter(Boolean).join(" · ") || "—"}
        </span>

        <span className={styles.chips}>
          {emp.firstEntry && (
            <span className={`${styles.chip} ${styles.chipIn}`}>
              <IconLogIn />
              {emp.firstEntry}
            </span>
          )}
          {emp.lastExit && (
            <span className={`${styles.chip} ${styles.chipOut}`}>
              <IconLogOut />
              {emp.lastExit}
            </span>
          )}
          {emp.late && (
            <span
              className={`${styles.chip} ${styles.chipTone}`}
              style={toneStyle("amber")}
            >
              <IconClock />+{formatMinutes(emp.lateMinutes, t)}
            </span>
          )}
          {emp.timeOffInfo && (
            <span
              className={`${styles.chip} ${styles.chipTone}`}
              style={toneStyle("teal")}
            >
              <IconSun />
              {timeOffText(emp.timeOffInfo, t)}
            </span>
          )}
        </span>
      </span>

      <span className={styles.pill}>{t(STATUS_META[status].singularKey)}</span>
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

const EmployeeSheet = ({ emp, extra, isToday, isOpen, onClose, t }) => {
  const status = emp ? primaryStatus(emp, isToday) : "present";
  const hasVisit = emp && (emp.present || emp.firstEntry || emp.lastExit);

  return (
    <TgSheet
      isOpen={isOpen}
      onClose={onClose}
      title={emp?.employeeFullName || ""}
      subtitle={emp?.positionName || undefined}
    >
      {emp && (
        <div className={styles.sheet} style={toneStyle(STATUS_META[status].tone)}>
          <div className={styles.sheetTop}>
            <Avatar emp={emp} className={styles.sheetAvatar} />
            <div className={styles.sheetStatus}>
              <span className={styles.pill}>{t(STATUS_META[status].singularKey)}</span>
              {emp.late && (
                <span className={styles.sheetLate}>
                  {t("attendanceTg.lateBy", { time: formatMinutes(emp.lateMinutes, t) })}
                </span>
              )}
            </div>
          </div>

          {hasVisit && (
            <div className={styles.times}>
              <div className={styles.timeCell}>
                <span className={styles.timeLabel}>{t("entryTime")}</span>
                <b>{emp.firstEntry || "—"}</b>
              </div>
              <div className={styles.timeCell}>
                <span className={styles.timeLabel}>{t("exit")}</span>
                <b>{emp.lastExit || "—"}</b>
              </div>
              <div className={styles.timeCell}>
                <span className={styles.timeLabel}>{t("attendanceTg.worked")}</span>
                <b>{extra?.workDuration || "—"}</b>
              </div>
            </div>
          )}

          {emp.timeOffInfo && (
            <div className={styles.timeOff} style={toneStyle("teal")}>
              <IconSun />
              <span>{timeOffText(emp.timeOffInfo, t)}</span>
            </div>
          )}

          <ul className={styles.info}>
            <InfoRow icon={<IconDoor />} label={t("turnstile")} value={emp.firstEntryDoor} />
            <InfoRow
              icon={<IconClock />}
              label={t("scheduledTime")}
              value={extra?.scheduledStart}
            />
            <InfoRow icon={<IconHash />} label={t("tabNumber")} value={emp.employeeNumber} />
            <InfoRow icon={<IconMapPin />} label={t("branch")} value={emp.branchName} />
            <InfoRow icon={<IconBuilding />} label={t("department")} value={emp.departmentName} />
            <InfoRow icon={<IconBriefcase />} label={t("position")} value={emp.positionName} />
          </ul>
        </div>
      )}
    </TgSheet>
  );
};

// Список сотрудников карточками: подгружается порциями по мере прокрутки,
// тап по карточке открывает шторку с подробностями дня.
const AttendanceTableTelegram = ({
  employees = [],
  extras,
  isToday = true,
  scrollRootRef,
}) => {
  const { t } = useTranslation();

  const [visible, setVisible] = useState(PAGE_SIZE);
  const [shown, setShown] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const sentinelRef = useRef(null);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [employees]);

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
          <EmployeeCard
            key={emp.employeeId}
            emp={emp}
            isToday={isToday}
            onOpen={openEmployee}
            t={t}
          />
        ))}

        {hasMore && <span ref={sentinelRef} className={styles.sentinel} />}
      </div>

      <EmployeeSheet
        emp={shown}
        extra={shown ? extras?.get(shown.employeeId) : null}
        isToday={isToday}
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        t={t}
      />
    </>
  );
};

export default AttendanceTableTelegram;
