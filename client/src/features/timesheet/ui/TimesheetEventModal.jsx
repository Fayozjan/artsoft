import { useEffect, useRef } from "react";
import { t } from "i18next";

import { formatIsoToLocalDateTime } from "../../../utils/date";

import Badge from "../../../components/Badge";

import styles from "./TimesheetEventModal.module.scss";

const TimesheetEventModal = ({ visible, onClose, events, timeOffs }) => {
  if (!visible) return null;

  const modalRef = useRef(null);

  // Закрытие по нажатию клавиши ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Закрытие по клику вне окна

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} ref={modalRef}>
        {events.length === 0 ? (
          <p className={styles.empty}>Нет событий</p>
        ) : (
          <ul className={styles.eventList}>
            {events.map((event, index) => {
              return (
                <li key={index} className={styles.eventItem}>
                  <div>
                    <div className={styles.eventNumber}>
                      Cобытиe {index + 1}
                    </div>
                    <p>
                      <strong>ФИО: </strong>
                      {event.employee.employeeFullName}
                    </p>
                    <p>
                      <strong>Дверь: </strong> {event.doorName}
                    </p>
                    <p>
                      <strong>Направление: </strong>
                      <Badge text={event.direction} />
                    </p>
                    <p>
                      <strong>Время:</strong>{" "}
                      {formatIsoToLocalDateTime(event.date)}
                    </p>
                  </div>
                  {event.photo && (
                    <img src={`/api/face-passes/image/${event.photo}`} />
                  )}
                </li>
              );
            })}

            {timeOffs && (
              <div className={`${styles.eventItem} ${styles.borderOrange}`}>
                <div>
                  <p>
                    <strong>Тип:</strong> {t(timeOffs.type)}
                  </p>
                  <p>
                    <strong>Причина:</strong> {timeOffs.reason}
                  </p>
                  <p>
                    <strong>Оплачиваемый:</strong>{" "}
                    {timeOffs.isCompanyPaid ? "Да" : "Нет"}
                  </p>
                </div>
              </div>
            )}
          </ul>
        )}
      </div>
    </div>
  );
};

export default TimesheetEventModal;
