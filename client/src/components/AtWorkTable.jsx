import { useEffect, useRef, useState } from "react";

import styles from "./AtWorkTable.module.scss";
import { useTranslation } from "react-i18next";
import { Icons } from "../icons/icons";
import SortArrow from "./SortArrow";

const fullName = (info, id) =>
  [info.surname, info.name, info.patronymic, id].filter(Boolean).join(" ");

const AtWorkTable = ({ data, onClose }) => {
  const { t } = useTranslation();
  const modalRef = useRef(null);
  const [btnSwitch, setBtnSwich] = useState("arrived");
  const [arrivedSortField, setArrivedSortField] = useState(null);
  const [arrivedSortOrder, setArrivedSortOrder] = useState("asc");
  const [absentSortField, setAbsentSortField] = useState(null);
  const [absentSortOrder, setAbsentSortOrder] = useState("asc");

  const toggleSort = (field, current, setField, setOrder) => {
    if (current === field) {
      setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setField(field);
      setOrder("asc");
    }
  };

  const handleArrivedSort = (field) =>
    toggleSort(field, arrivedSortField, setArrivedSortField, setArrivedSortOrder);
  const handleAbsentSort = (field) =>
    toggleSort(field, absentSortField, setAbsentSortField, setAbsentSortOrder);

  const getArrivedValue = (item, field) => {
    if (field === "fullName") return fullName(item.employeeInfo, item.employeeId);
    if (field === "department") return item.employeeInfo.department_name || "";
    if (field === "position") return item.employeeInfo.position_name || "";
    return item[field];
  };

  const sortedArrived = arrivedSortField
    ? [...(data?.arrived || [])].sort((a, b) => {
        const aVal = getArrivedValue(a, arrivedSortField);
        const bVal = getArrivedValue(b, arrivedSortField);
        return arrivedSortOrder === "asc"
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      })
    : data?.arrived || [];

  const getAbsentValue = (item, field) => {
    if (field === "fullName") return fullName(item, item.user_id);
    return item[field] || "";
  };

  const sortedAbsent = absentSortField
    ? [...(data?.absent || [])].sort((a, b) => {
        const aVal = getAbsentValue(a, absentSortField);
        const bVal = getAbsentValue(b, absentSortField);
        return absentSortOrder === "asc"
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      })
    : data?.absent || [];

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
        <span className={styles.closeButton} onClick={onClose} style={{ display: "flex", cursor: "pointer" }}>{Icons.clear}</span>
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
                  <th className={styles.table_name_header} onClick={() => handleArrivedSort("fullName")}>
                    <span className={styles.headerContent}>
                      {t("fullName")}
                      <SortArrow active={arrivedSortField === "fullName"} order={arrivedSortOrder} />
                    </span>
                  </th>
                  <th onClick={() => handleArrivedSort("department")}>
                    <span className={styles.headerContent}>
                      {t("department")}
                      <SortArrow active={arrivedSortField === "department"} order={arrivedSortOrder} />
                    </span>
                  </th>
                  <th onClick={() => handleArrivedSort("position")}>
                    <span className={styles.headerContent}>
                      {t("position")}
                      <SortArrow active={arrivedSortField === "position"} order={arrivedSortOrder} />
                    </span>
                  </th>
                  <th>{t("photo")}</th>
                  <th onClick={() => handleArrivedSort("firstEntry")}>
                    <span className={styles.headerContent}>
                      {t("entry")}
                      <SortArrow active={arrivedSortField === "firstEntry"} order={arrivedSortOrder} />
                    </span>
                  </th>
                  <th onClick={() => handleArrivedSort("lastEvent")}>
                    <span className={styles.headerContent}>
                      {t("atWorkplace")}
                      <SortArrow active={arrivedSortField === "lastEvent"} order={arrivedSortOrder} />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedArrived.map((item, i) => (
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
                  <th className={styles.table_name_header} onClick={() => handleAbsentSort("fullName")}>
                    <span className={styles.headerContent}>
                      {t("fullName")}
                      <SortArrow active={absentSortField === "fullName"} order={absentSortOrder} />
                    </span>
                  </th>
                  <th onClick={() => handleAbsentSort("department_name")}>
                    <span className={styles.headerContent}>
                      {t("department")}
                      <SortArrow active={absentSortField === "department_name"} order={absentSortOrder} />
                    </span>
                  </th>
                  <th onClick={() => handleAbsentSort("position_name")}>
                    <span className={styles.headerContent}>
                      {t("position")}
                      <SortArrow active={absentSortField === "position_name"} order={absentSortOrder} />
                    </span>
                  </th>
                  <th>{t("photo")}</th>
                </tr>
              </thead>
              <tbody>
                {sortedAbsent.map((item, i) => (
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
