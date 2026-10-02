import { useEffect, useRef, useState } from "react";

import styles from "./AtWorkList.module.scss";
import { useTranslation } from "react-i18next";
import { Icons } from "../icons/icons";
import SortArrow from "./SortArrow";

const fullName = (item) =>
  [item.employeeInfo.surname, item.employeeInfo.name, item.employeeInfo.patronymic, item.employeeId]
    .filter(Boolean)
    .join(" ");

const AtWorkTable = ({ data, onClose }) => {
  const { t } = useTranslation();
  const modalRef = useRef(null);
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getSortValue = (item, field) => {
    switch (field) {
      case "fullName":
        return fullName(item);
      case "department":
        return item.employeeInfo.department_name || "";
      case "position":
        return item.employeeInfo.position_name || "";
      default:
        return item[field] || "";
    }
  };

  const sortedData = sortField
    ? [...data].sort((a, b) => {
        const aVal = getSortValue(a, sortField);
        const bVal = getSortValue(b, sortField);
        return sortOrder === "asc"
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      })
    : data;

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
        <h1>{t("leftWorkList")}</h1>
        <div className={styles.tableContainer}>
          <table className={styles.employee_table}>
            <thead>
              <tr>
                <th>№</th>
                <th className={styles.table_name_header} onClick={() => handleSort("fullName")}>
                  <span className={styles.headerContent}>
                    {t("fullName")}
                    <SortArrow active={sortField === "fullName"} order={sortOrder} />
                  </span>
                </th>
                <th onClick={() => handleSort("department")}>
                  <span className={styles.headerContent}>
                    {t("department")}
                    <SortArrow active={sortField === "department"} order={sortOrder} />
                  </span>
                </th>
                <th onClick={() => handleSort("position")}>
                  <span className={styles.headerContent}>
                    {t("position")}
                    <SortArrow active={sortField === "position"} order={sortOrder} />
                  </span>
                </th>
                <th>{t("photo")}</th>
                <th onClick={() => handleSort("firstEntry")}>
                  <span className={styles.headerContent}>
                    {t("entry")}
                    <SortArrow active={sortField === "firstEntry"} order={sortOrder} />
                  </span>
                </th>
                <th onClick={() => handleSort("lastExit")}>
                  <span className={styles.headerContent}>
                    {t("exit")}
                    <SortArrow active={sortField === "lastExit"} order={sortOrder} />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedData.map((item, i) => (
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
