import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import {
  formatIsoToLocalDateTime,
  formatIsoToLocalDate,
} from "../../../utils/date";

import Badge from "../../../components/Badge";

import styles from "./TimesheetEventModal.module.scss";

const TimesheetEventModal = ({ visible, onClose, events, timeOffs }) => {
  const { t } = useTranslation();
  const modalRef = useRef(null);

  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, visible]);

  useEffect(() => {
    if (!visible) return;
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, visible]);

  if (!visible) return null;

  const hasEvents = events && events.length > 0;
  const hasTimeOffs = !!timeOffs;
  const isEmpty = !hasEvents && !hasTimeOffs;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} ref={modalRef}>
        {isEmpty ? (
          <p className={styles.empty}>{t("noEventsOrTimeOffs")}</p>
        ) : (
          <ul className={styles.eventList}>
            {hasEvents &&
              events.map((event, index) => (
                <li key={index} className={styles.eventItem}>
                  <div>
                    <div className={styles.eventNumber}>
                      {t("eventNumber", { n: index + 1 })}
                    </div>
                    <p>
                      <strong>{t("fullName")}: </strong>
                      {event.employee.employeeFullName}
                    </p>
                    <p>
                      <strong>{t("door")}: </strong> {event.doorName}
                    </p>
                    <p>
                      <strong>{t("direction")}: </strong>
                      <Badge text={event.direction} />
                    </p>
                    <p>
                      <strong>{t("time")}:</strong>{" "}
                      {formatIsoToLocalDateTime(event.date)}
                    </p>
                  </div>
                  {event.photo && (
                    <img
                      src={`/api/face-passes/image/${event.photo}`}
                      alt="Event"
                    />
                  )}
                </li>
              ))}

            {hasTimeOffs && (
              <li className={`${styles.eventItem} ${styles.borderOrange}`}>
                <div>
                  <div className={styles.eventNumber}>
                    {t("absenceInfo")}
                  </div>
                  <p>
                    <strong>{t("from")}:</strong>{" "}
                    {timeOffs.type === "hour"
                      ? formatIsoToLocalDateTime(timeOffs.date_from)
                      : formatIsoToLocalDate(timeOffs.date_from)}{" "}
                    <strong>{t("to")}:</strong>{" "}
                    {timeOffs.type === "hour"
                      ? formatIsoToLocalDateTime(timeOffs.date_to)
                      : formatIsoToLocalDate(timeOffs.date_to)}
                  </p>
                  <p>
                    <strong>{t("type")}:</strong> {t(timeOffs.type)}
                  </p>
                  <p>
                    <strong>{t("dashboard.reason")}:</strong> {timeOffs.reason}
                  </p>
                  <p>
                    <strong>{t("isPaid")}:</strong>{" "}
                    {timeOffs.isCompanyPaid ? t("yes") : t("no")}
                  </p>
                </div>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
};

export default TimesheetEventModal;
