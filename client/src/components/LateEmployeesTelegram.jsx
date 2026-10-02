import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import TgSheet from "./tg/TgSheet";
import {
  IconAlarm,
  IconArrowRight,
  IconBriefcase,
  IconBuilding,
  IconClock,
  IconCoffee,
  IconFlag,
  IconHash,
  IconMapPin,
  IconSun,
  IconWallet,
} from "./tg/tgIcons";
import { formatDate, formatMinutes, initialOf, toneStyle } from "../utils/attendanceTelegram";
import { SEVERITY_TONES, formatMoney, hhmm, occurrences, severityOf } from "../utils/lateTelegram";

import listStyles from "./AttendanceTableTelegram.module.scss";
import styles from "./LateEmployeesTelegram.module.scss";

const PAGE_SIZE = 40;

const Avatar = ({ emp, className }) => {
  const [failed, setFailed] = useState(false);
  const showPhoto = emp.photo && !failed;

  return (
    <span className={className}>
      {showPhoto ? (
        <img
          src={`/api/employees/image/${emp.photo}`}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={listStyles.initial}>{initialOf(emp.fullName)}</span>
      )}
    </span>
  );
};

// Причина отгула: «за счёт компании» — отдельный статус, остальное — «отлучка»
const timeOffText = (timeOff, t) => timeOff?.reason || t("excusedLeave");

const EmployeeCard = ({ emp, isPeriod, onOpen, t }) => {
  const severity = severityOf(emp, isPeriod);
  const detail = emp.details[0];
  const timeOff = !isPeriod ? detail?.timeOff : null;

  // Справа — главное число: за день «на сколько», за период «сколько раз»
  const pill = isPeriod
    ? `${occurrences(emp)}×`
    : `+${formatMinutes(emp.minutes || emp.breakMinutes, t)}`;

  return (
    <button
      type="button"
      className={listStyles.card}
      style={toneStyle(SEVERITY_TONES[severity])}
      onClick={() => onOpen(emp)}
    >
      <Avatar emp={emp} className={listStyles.avatar} />

      <span className={listStyles.main}>
        <span className={listStyles.name}>{emp.fullName || "—"}</span>
        <span className={listStyles.sub}>
          {[emp.position, emp.department].filter(Boolean).join(" · ") || "—"}
        </span>

        <span className={listStyles.chips}>
          {!isPeriod && detail?.actual && (
            <span className={listStyles.chip}>
              <IconClock />
              {detail.scheduled && (
                <>
                  <span className={styles.planned}>{detail.scheduled}</span>
                  <IconArrowRight />
                </>
              )}
              {detail.actual}
            </span>
          )}

          {isPeriod && (
            <span className={listStyles.chip}>
              <IconClock />
              {hhmm(emp.minutes)}
            </span>
          )}

          {emp.breakMinutes > 0 && (
            <span
              className={`${listStyles.chip} ${listStyles.chipTone}`}
              style={toneStyle("orange")}
            >
              <IconCoffee />
              {isPeriod ? `${emp.breakCount}×` : `+${formatMinutes(emp.breakMinutes, t)}`}
            </span>
          )}

          {emp.money > 0 && (
            <span
              className={`${listStyles.chip} ${listStyles.chipTone}`}
              style={toneStyle("purple")}
            >
              <IconWallet />
              {formatMoney(emp.money)}
            </span>
          )}

          {timeOff && (
            <span
              className={`${listStyles.chip} ${listStyles.chipTone}`}
              style={toneStyle("teal")}
            >
              <IconSun />
              {timeOffText(timeOff, t)}
            </span>
          )}
        </span>
      </span>

      <span className={listStyles.pill}>{pill}</span>
    </button>
  );
};

const InfoRow = ({ icon, label, value }) =>
  value ? (
    <li className={listStyles.infoRow}>
      <span className={listStyles.infoIcon}>{icon}</span>
      <span className={listStyles.infoLabel}>{label}</span>
      <span className={listStyles.infoValue}>{value}</span>
    </li>
  ) : null;

// Одно опоздание в подробностях: дата, план → факт, опоздание и возврат с перерыва
const DetailRow = ({ detail, language, t }) => (
  <li className={styles.detail}>
    <span className={styles.detailDate}>
      <small>{formatDate(detail.date, language, { weekday: "short" })}</small>
      <b>{formatDate(detail.date, language, { day: "numeric" })}</b>
    </span>

    <span className={styles.detailMain}>
      <span className={styles.detailLine}>
        <span className={styles.planned}>{detail.scheduled || "—"}</span>
        <IconArrowRight />
        <b>{detail.actual || "—"}</b>
        {detail.late > 0 && (
          <span className={styles.detailPill} style={toneStyle("amber")}>
            +{formatMinutes(detail.late, t)}
          </span>
        )}
      </span>

      {(detail.breakReturn || detail.breakLate > 0) && (
        <span className={styles.detailLine}>
          <IconCoffee />
          <span className={styles.planned}>{detail.breakEnd || "—"}</span>
          <IconArrowRight />
          <b>{detail.breakReturn || "—"}</b>
          {detail.breakLate > 0 && (
            <span className={styles.detailPill} style={toneStyle("orange")}>
              +{formatMinutes(detail.breakLate, t)}
            </span>
          )}
        </span>
      )}
    </span>
  </li>
);

const EmployeeSheet = ({ emp, isPeriod, isOpen, onClose, language, t }) => {
  const severity = emp ? severityOf(emp, isPeriod) : "low";
  const tone = toneStyle(SEVERITY_TONES[severity]);
  const detail = emp?.details[0];
  const shot = !isPeriod ? detail?.photo || emp?.fallbackPhoto : null;

  return (
    <TgSheet
      isOpen={isOpen}
      onClose={onClose}
      title={emp?.fullName || ""}
      subtitle={emp?.position || undefined}
    >
      {emp && (
        <div className={listStyles.sheet} style={tone}>
          <div className={listStyles.sheetTop}>
            <Avatar emp={emp} className={listStyles.sheetAvatar} />
            <div className={listStyles.sheetStatus}>
              <span className={listStyles.pill}>
                {isPeriod
                  ? t("lateTg.timesCount", { count: occurrences(emp) })
                  : `+${formatMinutes(emp.minutes || emp.breakMinutes, t)}`}
              </span>
              <span className={listStyles.sheetLate}>
                {t(`lateTg.severity.${isPeriod ? "period" : "day"}.${severity}`)}
              </span>
            </div>
          </div>

          {isPeriod ? (
            <div className={listStyles.times}>
              <div className={listStyles.timeCell}>
                <span className={listStyles.timeLabel}>{t("lateTg.lateCount")}</span>
                <b>{emp.count}</b>
              </div>
              <div className={listStyles.timeCell}>
                <span className={listStyles.timeLabel}>{t("lateTg.totalTime")}</span>
                <b>{hhmm(emp.minutes)}</b>
              </div>
              <div className={listStyles.timeCell}>
                <span className={listStyles.timeLabel}>{t("penaltyAmount")}</span>
                <b>{emp.money > 0 ? formatMoney(emp.money) : "—"}</b>
              </div>
            </div>
          ) : (
            <div className={listStyles.times}>
              <div className={listStyles.timeCell}>
                <span className={listStyles.timeLabel}>{t("scheduledStart")}</span>
                <b>{detail?.scheduled || "—"}</b>
              </div>
              <div className={listStyles.timeCell}>
                <span className={listStyles.timeLabel}>{t("arrived")}</span>
                <b>{detail?.actual || "—"}</b>
              </div>
              <div className={listStyles.timeCell}>
                <span className={listStyles.timeLabel}>{t("penaltyAmount")}</span>
                <b>{emp.money > 0 ? formatMoney(emp.money) : "—"}</b>
              </div>
            </div>
          )}

          {!isPeriod && detail?.timeOff && (
            <div className={listStyles.timeOff} style={toneStyle("teal")}>
              <IconSun />
              <span>{timeOffText(detail.timeOff, t)}</span>
            </div>
          )}

          {shot && (
            <figure className={styles.shot}>
              <img src={`/api/face-passes/image/${shot}`} alt="" loading="lazy" />
              <figcaption>{t("latePhoto")}</figcaption>
            </figure>
          )}

          {!isPeriod && emp.breakMinutes > 0 && (
            <div className={styles.breakBlock} style={toneStyle("orange")}>
              <IconCoffee />
              <span className={styles.breakText}>
                <b>{t("lateAfterBreak")}</b>
                <span>
                  {detail?.breakEnd || "—"} → {detail?.breakReturn || "—"}
                </span>
              </span>
              <span className={styles.detailPill}>
                +{formatMinutes(emp.breakMinutes, t)}
              </span>
            </div>
          )}

          {isPeriod && emp.details.length > 0 && (
            <div className={styles.detailBlock}>
              <span className={styles.detailTitle}>{t("lateTg.byDays")}</span>
              <ul className={styles.detailList}>
                {emp.details.map((item) => (
                  <DetailRow key={item.date} detail={item} language={language} t={t} />
                ))}
              </ul>
            </div>
          )}

          <ul className={listStyles.info}>
            {isPeriod && emp.workDays > 0 && (
              <InfoRow
                icon={<IconFlag />}
                label={t("workedDays")}
                value={`${emp.attendedDays} ${t("of")} ${emp.workDays}`}
              />
            )}
            {isPeriod && emp.breakCount > 0 && (
              <InfoRow
                icon={<IconCoffee />}
                label={t("lateAfterBreak")}
                value={`${emp.breakCount} · ${hhmm(emp.breakMinutes)}`}
              />
            )}
            <InfoRow icon={<IconHash />} label={t("tabNumber")} value={emp.number} />
            <InfoRow icon={<IconMapPin />} label={t("branch")} value={emp.branch} />
            <InfoRow icon={<IconBuilding />} label={t("department")} value={emp.department} />
            <InfoRow icon={<IconBriefcase />} label={t("position")} value={emp.position} />
          </ul>
        </div>
      )}
    </TgSheet>
  );
};

// Список опоздавших карточками: подгружается порциями по мере прокрутки,
// тап по карточке открывает шторку с подробностями.
const LateEmployeesTelegram = ({ employees = [], isPeriod = false, scrollRootRef }) => {
  const { t, i18n } = useTranslation();

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
      <div className={listStyles.empty}>
        <span className={listStyles.emptyIcon}>
          <IconAlarm />
        </span>
        <p>{t("lateTg.empty")}</p>
      </div>
    );
  }

  return (
    <>
      <div className={listStyles.list}>
        {employees.slice(0, visible).map((emp) => (
          <EmployeeCard key={emp.key} emp={emp} isPeriod={isPeriod} onOpen={openEmployee} t={t} />
        ))}

        {hasMore && <span ref={sentinelRef} className={listStyles.sentinel} />}
      </div>

      <EmployeeSheet
        emp={shown}
        isPeriod={isPeriod}
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        language={i18n.language}
        t={t}
      />
    </>
  );
};

export default LateEmployeesTelegram;
