import { useEffect, useRef } from "react";

import styles from "./AtWorkList.module.scss";

const AtWorkTable = ({ data, onClose }) => {
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
      <div className={styles.table_body} ref={modalRef}>
        <svg
          className={styles.closeButton}
          onClick={onClose}
          viewBox="0 0 256 256"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect fill="none" height="256" width="256" />
          <line
            fill="none"
            stroke="#000"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="24"
            x1="200"
            x2="56"
            y1="56"
            y2="200"
          />
          <line
            fill="none"
            stroke="#000"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="24"
            x1="200"
            x2="56"
            y1="200"
            y2="56"
          />
        </svg>
        <h1>Список сотрудников которые ушли с работы</h1>
        <div className={styles.tableContainer}>
          <table className={styles.employee_table}>
            <thead>
              <tr>
                <th>№</th>
                <th className={styles.table_name_header}>ФИО</th>
                <th>Отдел</th>
                <th>Должность</th>
                <th>Фото</th>
                <th>Вход</th>
                <th>Выход</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, i) => (
                <tr key={item.employeeId}>
                  <td>{i + 1}</td>
                  <td>
                    {[
                      item.employeeInfo.surname,
                      item.employeeInfo.name,
                      item.employeeInfo.patronymic,
                      item.employeeId,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  </td>
                  <td>{item.employeeInfo.department_name}</td>
                  <td>{item.employeeInfo.position_name}</td>
                  <td>
                    {item.photo ? (
                      <img src={item.photo} alt="user-photo" />
                    ) : null}
                  </td>
                  <td>{item.firstEntry}</td>
                  <td>{item.lastExit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AtWorkTable;
