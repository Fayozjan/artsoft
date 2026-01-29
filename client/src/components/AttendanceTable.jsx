import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import SortArrow from "./SortArrow";
import DownloadButton from "./DownloadButton";
import AttendanceTableByEmployee from "./AttendanceTableByEmployee";
import Portal from "./Portal";

import styles from "./AttendanceTable.module.scss";

const AttendanceTable = ({ rowData = [] }) => {
  const [sortField, setSortField] = useState("employeeFullName" || "name");
  const [sortOrder, setSortOrder] = useState("asc");
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [openBranches, setOpenBranches] = useState({});
  const [modalData, setModalData] = useState(null);

  const prepareAttendanceData = (data) => {
    if (!data || !data.employees) return [];

    const presentIds = new Set(data.present.map((e) => e.employeeId));
    const absentIds = new Set(data.absent.map((e) => e.employeeId));
    const insideIds = new Set(data.inside.map((e) => e.employeeId));
    const leftIds = new Set(data.left.map((e) => e.employeeId));
    const lateIds = new Set(data.late.map((e) => e.employeeId));

    const presentMap = new Map(
      data.present.map((e) => [e.employeeId, e.firstEntry])
    );
    const leftMap = new Map(data.left.map((e) => [e.employeeId, e.lastExit]));
    const lateMap = new Map(
      data.late.map((e) => [e.employeeId, e.lateMinutes])
    );

    const branchesMap = {};

    data.employees.forEach((emp) => {
      const branchName = emp.branchName || "Без филиала";
      const departmentName = emp.departmentName || "Без отдела";

      if (!branchesMap[branchName]) {
        branchesMap[branchName] = {
          name: branchName,
          totalEmployees: 0,
          present: 0,
          absent: 0,
          inside: 0,
          left: 0,
          late: 0,
          employees: [],
          departments: {},
        };
      }

      const branch = branchesMap[branchName];

      // Счётчики филиала
      branch.totalEmployees += 1;
      if (presentIds.has(emp.id)) branch.present += 1;
      if (absentIds.has(emp.id)) branch.absent += 1;
      if (insideIds.has(emp.id)) branch.inside += 1;
      if (leftIds.has(emp.id)) branch.left += 1;
      if (lateIds.has(emp.id)) branch.late += 1;

      // Добавляем сотрудника
      const employeeRecord = {
        employeeId: emp.id,
        employeeFullName: emp.employeeFullName,
        employeeNumber: emp.employeeNumber,
        employeePhoto: emp.photo,
        branchName: emp.branchName,
        departmentName: emp.departmentName,
        positionName: emp.positionName,
        present: presentIds.has(emp.id),
        absent: absentIds.has(emp.id),
        inside: insideIds.has(emp.id),
        left: leftIds.has(emp.id),
        late: lateIds.has(emp.id),
        firstEntry: presentMap.get(emp.id) || null,
        lastExit: leftMap.get(emp.id) || null,
        lateMinutes: lateMap.get(emp.id) || 0,
      };
      branch.employees.push(employeeRecord);

      // Обработка отделов
      if (!branch.departments[departmentName]) {
        branch.departments[departmentName] = {
          name: departmentName,
          totalEmployees: 0,
          present: 0,
          absent: 0,
          inside: 0,
          left: 0,
          late: 0,
          employees: [],
        };
      }

      const dept = branch.departments[departmentName];
      dept.totalEmployees += 1;
      if (presentIds.has(emp.id)) dept.present += 1;
      if (absentIds.has(emp.id)) dept.absent += 1;
      if (insideIds.has(emp.id)) dept.inside += 1;
      if (leftIds.has(emp.id)) dept.left += 1;
      if (lateIds.has(emp.id)) dept.late += 1;
      dept.employees.push(employeeRecord);
    });

    return Object.values(branchesMap).map((branch) => ({
      ...branch,
      departments: Object.values(branch.departments),
    }));
  };

  const getSortedData = () => {
    return [...data].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Пустые значения идут в конец
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // Преобразование к числу, если возможно
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);

      const isNumberA = !isNaN(aNum);
      const isNumberB = !isNaN(bNum);

      if (isNumberA && isNumberB) {
        return sortOrder === "asc" ? aNum - bNum : bNum - aNum;
      }

      // Сравнение как строки
      return sortOrder === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const toggleBranch = (branchName) => {
    setOpenBranches((prev) => ({
      ...prev,
      [branchName]: !prev[branchName],
    }));
  };

  const data = useMemo(() => {
    return prepareAttendanceData(rowData);
  }, [rowData]);

  useEffect(() => {
    if (data.length === 1) {
      const branchName = data[0].name;

      setOpenBranches((prev) => {
        if (prev[branchName]) return prev;
        return { [branchName]: true };
      });
    }
  }, [data]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.searchInput}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="19"
            viewBox="0 0 24 24"
          >
            <path
              fill="#000000"
              d="M15.096 5.904a6.5 6.5 0 1 0-9.192 9.192a6.5 6.5 0 0 0 9.192-9.192ZM4.49 4.49a8.5 8.5 0 0 1 12.686 11.272l5.345 5.345l-1.414 1.414l-5.345-5.345A8.501 8.501 0 0 1 4.49 4.49Z"
            />
          </svg>
          <input
            type="text"
            placeholder={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {search && (
            <svg
              className={styles.clearBtn}
              onClick={() => setSearch("")}
              xmlns="http://www.w3.org/2000/svg"
              width="19"
              height="18"
              viewBox="0 0 24 24"
            >
              <path
                fill="none"
                stroke="#000000"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          )}
        </div>
        {Object.keys(prepareAttendanceData).length > 0 && (
          <DownloadButton text={t("save")} onClick={() => {}} />
        )}
      </div>
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>№</th>
              <th
                className={styles.table_name_header}
                onClick={() => handleSort("name")}
              >
                <span className={styles.headerContent}>
                  {t("branch")}
                  <SortArrow active={sortField === "name"} order={sortOrder} />
                </span>
              </th>
              <th onClick={() => handleSort("department_count")}>
                <span className={styles.headerContent}>
                  Всего сотрудников
                  <SortArrow
                    active={sortField === "department_count"}
                    order={sortOrder}
                  />
                </span>
              </th>
              <th onClick={() => handleSort("employee_count")}>
                <span className={styles.headerContent}>
                  Пришли
                  <SortArrow
                    active={sortField === "employee_count"}
                    order={sortOrder}
                  />
                </span>
              </th>
              <th onClick={() => handleSort("status")}>
                <span className={styles.headerContent}>
                  Не пришли
                  <SortArrow
                    active={sortField === "status"}
                    order={sortOrder}
                  />
                </span>
              </th>
              <th onClick={() => handleSort("status")}>
                <span className={styles.headerContent}>
                  Опоздали
                  <SortArrow
                    active={sortField === "status"}
                    order={sortOrder}
                  />
                </span>
              </th>
              <th onClick={() => handleSort("status")}>
                <span className={styles.headerContent}>
                  На месте
                  <SortArrow
                    active={sortField === "status"}
                    order={sortOrder}
                  />
                </span>
              </th>
              <th onClick={() => handleSort("status")}>
                <span className={styles.headerContent}>
                  Ушли
                  <SortArrow
                    active={sortField === "status"}
                    order={sortOrder}
                  />
                </span>
              </th>
              <th onClick={() => handleSort("status")}>
                <span className={styles.headerContent}>
                  Показать по отделу
                  <SortArrow
                    active={sortField === "status"}
                    order={sortOrder}
                  />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data?.length > 0 ? (
              getSortedData().map((branch, index) => (
                <>
                  <tr onClick={() => setModalData(branch.employees)}>
                    <td>{index + 1}</td>
                    <td>{branch.name}</td>
                    <td>{branch.totalEmployees}</td>
                    <td>{branch.present}</td>
                    <td>{branch.absent}</td>
                    <td>{branch.late}</td>
                    <td>{branch.inside}</td>
                    <td>{branch.left}</td>
                    <td
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleBranch(branch.name);
                      }}
                    >
                      Показать
                    </td>
                  </tr>

                  {openBranches[branch.name] &&
                    branch.departments.map((dept, i) => (
                      <tr
                        key={dept.name}
                        className={styles.departmentRow}
                        onClick={() => setModalData(dept.employees)}
                      >
                        <td>{`${index + 1}.${i + 1}`}</td>
                        <td>{dept.name}</td>
                        <td>{dept.totalEmployees}</td>
                        <td>{dept.present}</td>
                        <td>{dept.absent}</td>
                        <td>{dept.late}</td>
                        <td>{dept.inside}</td>
                        <td>{dept.left}</td>
                        <td></td>
                      </tr>
                    ))}
                </>
              ))
            ) : (
              <tr>
                <td colSpan="11">Нет данных</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Portal isOpen={!!modalData} onClose={() => setModalData(null)}>
        <AttendanceTableByEmployee data={modalData} />
      </Portal>
    </div>
  );
};

export default AttendanceTable;
