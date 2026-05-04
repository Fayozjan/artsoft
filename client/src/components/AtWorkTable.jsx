import { useEffect, useRef, useState } from "react";

import styles from "./AtWorkTable.module.scss";
import { useTranslation } from "react-i18next";

const AtWorkTable = ({ data, onClose }) => {
  const { t } = useTranslation();
  const modalRef = useRef(null);
  const [btnSwitch, setBtnSwich] = useState("arrived");

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
        <h1>{t("presentAbsentList")}</h1>
        <div className={styles.buttons}>
          <button
            className={btnSwitch === "arrived" ? styles.activeBtn : ""}
            onClick={() => setBtnSwich("arrived")}
          >
            {t("checkedIn")}
          </button>
          <button
            className={btnSwitch === "absent" ? styles.activeBtn : ""}
            onClick={() => setBtnSwich("absent")}
          >
            {t("notCheckedIn")}
          </button>
        </div>

        {btnSwitch === "arrived" ? (
          <div className={styles.tableContainer}>
            <table className={styles.employee_table}>
              <thead>
                <tr>
                  <th>№</th>
                  <th className={styles.table_name_header}>{t("fullName")}</th>
                  <th>{t("department")}</th>
                  <th>{t("position")}</th>
                  <th>{t("photo")}</th>
                  <th>{t("entry")}</th>
                  <th>{t("atWorkplace")}</th>
                </tr>
              </thead>
              <tbody>
                {data?.arrived?.map((item, i) => (
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
                    <td>{item.lastEvent === "entry" ? t("yes") : t("no")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.tableContainer}>
            <table className={styles.employee_table}>
              <thead>
                <tr>
                  <th>№</th>
                  <th className={styles.table_name_header}>{t("fullName")}</th>
                  <th>{t("department")}</th>
                  <th>{t("position")}</th>
                  <th>{t("photo")}</th>
                </tr>
              </thead>
              <tbody>
                {data?.absent?.map((item, i) => (
                  <tr key={item.user_id}>
                    <td>{i + 1}</td>
                    <td>
                      {[item.surname, item.name, item.patronymic, item.user_id]
                        .filter(Boolean)
                        .join(" ")}
                    </td>
                    <td>{item.department_name}</td>
                    <td>{item.position_name || "-"}</td>
                    <td>
                      {item.photo ? (
                        <img src={item.photo} alt="user-photo" />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AtWorkTable;
