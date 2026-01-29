import { useEffect, useRef } from "react";

import styles from "./TimesheetEventModal.module.scss";
import Badge from "../../../components/Badge";

const TimesheetEventModal = ({ visible, onClose, events }) => {
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
              // Если это отгул
              if (event.leave_request) {
                const leave = event.leave_request;
                return (
                  <li
                    key={`leave-${index}`}
                    className={`${styles.eventItem} ${styles.leaveRequest}`}
                  >
                    <div>
                      <p>
                        <strong>Отгул / Командировка</strong>
                      </p>
                      <p>
                        <strong>Номер разрешения:</strong>{" "}
                        {leave.permission_number}
                      </p>
                      <p>
                        <strong>Тип: </strong>{" "}
                        {leave.type === "day" ? "Дневной" : "Почасовой"}
                      </p>

                      <p>
                        <strong>Период:</strong> {leave.date_from} –{" "}
                        {leave.date_to}
                      </p>
                      <p>
                        <strong>Причина:</strong> {leave.description}
                      </p>

                      <p>
                        <strong>Оплачиваемый: </strong>
                        {leave.company_paid ? "Да" : "Нет"}
                      </p>
                      {leave.credited_hours && (
                        <p>
                          <strong>Часы в учёт:</strong> {leave.credited_hours}
                        </p>
                      )}
                    </div>
                  </li>
                );
              }

              // Если это обычное событие входа/выхода
              return (
                <li key={index} className={styles.eventItem}>
                  <div>
                    <p>
                      <strong>Номер события: </strong>
                      {index + 1}
                    </p>
                    <p>
                      <strong>ФИО: </strong>
                      {event.employee.employeeFullName}
                    </p>
                    <p>
                      <strong>Рабочий график сотрудника: </strong>
                      {event.employee.work_schedule_name}
                    </p>
                    <p>
                      <strong>Дверь: </strong> {event.door_name}
                    </p>
                    <p>
                      <strong>Направление: </strong>
                      <Badge text={event.direction} />
                    </p>
                    <p>
                      <strong>Время:</strong> {event.event_time_string}
                    </p>
                  </div>

                  {event.event_photo && (
                    <img src={event.event_photo} alt="event_photo" />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default TimesheetEventModal;
