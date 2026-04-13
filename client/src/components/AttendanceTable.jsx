import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import SortArrow from "./SortArrow";
import DownloadButton from "./DownloadButton";
import AttendanceTableByEmployee from "./AttendanceTableByEmployee";
import Portal from "./Portal";
import { Switcher } from "./Switcher";

import styles from "./AttendanceTable.module.scss";

const STATUS_FILTERS = [
  {
    key: "present",
    label: "Пришли",
    color: "#16a34a",
    bg: "#f0fdf4",
    activeBg: "#16a34a",
    border: "#86efac",
  },
  {
    key: "absent",
    label: "Не пришли",
    color: "#dc2626",
    bg: "#fef2f2",
    activeBg: "#dc2626",
    border: "#fca5a5",
  },
  {
    key: "late",
    label: "Опоздали",
    color: "#d97706",
    bg: "#fffbeb",
    activeBg: "#d97706",
    border: "#fcd34d",
  },
  {
    key: "inside",
    label: "На месте",
    color: "#2563eb",
    bg: "#eff6ff",
    activeBg: "#2563eb",
    border: "#93c5fd",
  },
  {
    key: "left",
    label: "Ушли",
    color: "#7c3aed",
    bg: "#f5f3ff",
    activeBg: "#7c3aed",
    border: "#c4b5fd",
  },
];

const AttendanceTable = ({ rowData = [], viewMode }) => {
  const [sortField, setSortField] = useState("employeeFullName" || "name");
  const [sortOrder, setSortOrder] = useState("asc");
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [openBranches, setOpenBranches] = useState({});
  const [modalData, setModalData] = useState(null);
  const [displayMode, setDisplayMode] = useState("byEmployees");
  const [activeFilters, setActiveFilters] = useState(new Set());
  const viewTypes = ["byEmployees", "byDepartments"];

  // Переключение фильтра: если уже активен — снять, иначе добавить
  const toggleFilter = (key) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const prepareAttendanceData = (data) => {
    if (!data || !data.employees) return [];

    const presentIds = new Set(data.present.map((e) => e.employeeId));
    const absentIds = new Set(data.absent.map((e) => e.employeeId));
    const insideIds = new Set(data.inside.map((e) => e.employeeId));
    const leftIds = new Set(data.left.map((e) => e.employeeId));
    const lateIds = new Set(data.late.map((e) => e.employeeId));

    const presentMap = new Map(
      data.present.map((e) => [e.employeeId, e.firstEntry]),
    );
    const leftMap = new Map(data.left.map((e) => [e.employeeId, e.lastExit]));
    const lateMap = new Map(
      data.late.map((e) => [e.employeeId, e.lateMinutes]),
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
      branch.totalEmployees += 1;
      if (presentIds.has(emp.id)) branch.present += 1;
      if (absentIds.has(emp.id)) branch.absent += 1;
      if (insideIds.has(emp.id)) branch.inside += 1;
      if (leftIds.has(emp.id)) branch.left += 1;
      if (lateIds.has(emp.id)) branch.late += 1;

      const employeeRecord = {
        employeeId: emp.id,
        employeeFullName: emp.employeeFullName,
        employeeNumber: emp.employeeNumber,
        employeePhoto: emp.employeePhoto,
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

  const data = useMemo(() => prepareAttendanceData(rowData), [rowData]);

  const allEmployees = useMemo(
    () => data.flatMap((branch) => branch.employees),
    [data],
  );

  const allDepartments = useMemo(
    () => data.flatMap((branch) => branch.departments),
    [data],
  );

  // Применяем фильтры по статусу к массиву сотрудников
  const applyStatusFilter = (employees) => {
    if (activeFilters.size === 0) return employees;
    return employees.filter((emp) =>
      [...activeFilters].some((key) => emp[key] === true),
    );
  };

  const filteredEmployees = useMemo(() => {
    let result = allEmployees;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (emp) =>
          emp.employeeFullName?.toLowerCase().includes(q) ||
          emp.departmentName?.toLowerCase().includes(q) ||
          emp.positionName?.toLowerCase().includes(q),
      );
    }
    return applyStatusFilter(result);
  }, [allEmployees, search, activeFilters]);

  const filteredDepartments = useMemo(() => {
    if (!search.trim()) return allDepartments;
    const q = search.toLowerCase();
    return allDepartments.filter((dept) =>
      dept.name?.toLowerCase().includes(q),
    );
  }, [allDepartments, search]);

  const filteredBranches = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    return data.filter((branch) => branch.name?.toLowerCase().includes(q));
  }, [data, search]);

  const getSortedData = (arr) =>
    [...arr].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }

      return sortOrder === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });

  const sortedEmployees = useMemo(
    () => getSortedData(filteredEmployees),
    [filteredEmployees, sortField, sortOrder],
  );

  console.log("sortedEmployees", sortedEmployees);

  const sortedDepartments = useMemo(
    () => getSortedData(filteredDepartments),
    [filteredDepartments, sortField, sortOrder],
  );

  const sortedBranches = useMemo(
    () => getSortedData(filteredBranches),
    [filteredBranches, sortField, sortOrder],
  );

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

  useEffect(() => {
    if (data.length === 1) {
      const branchName = data[0].name;
      setOpenBranches((prev) => {
        if (prev[branchName]) return prev;
        return { [branchName]: true };
      });
    }
  }, [data]);

  // ─── Подсчёт для бейджей на кнопках ──────────────────────────────
  const statusCounts = useMemo(() => {
    const counts = {};
    STATUS_FILTERS.forEach(({ key }) => {
      counts[key] = allEmployees.filter((emp) => emp[key] === true).length;
    });
    return counts;
  }, [allEmployees]);

  // ─── Заголовки таблицы ────────────────────────────────────────────
  const renderThead = () => {
    if (viewMode === "branch" && displayMode === "byEmployees") {
      return (
        <tr>
          <th>№</th>
          <th onClick={() => handleSort("employeeFullName")}>
            <span className={styles.headerContent}>
              ФИО
              <SortArrow
                active={sortField === "employeeFullName"}
                order={sortOrder}
              />
            </span>
          </th>
          <th onClick={() => handleSort("departmentName")}>
            <span className={styles.headerContent}>
              Отдел
              <SortArrow
                active={sortField === "departmentName"}
                order={sortOrder}
              />
            </span>
          </th>
          <th onClick={() => handleSort("positionName")}>
            <span className={styles.headerContent}>
              Должность
              <SortArrow
                active={sortField === "positionName"}
                order={sortOrder}
              />
            </span>
          </th>
          <th>Пришёл</th>
          <th>Не пришёл</th>
          <th>Опоздал</th>
          <th>На месте</th>
          <th>Ушёл</th>
          <th>Первый вход</th>
          <th>Последний выход</th>
        </tr>
      );
    }

    if (viewMode === "branch" && displayMode === "byDepartments") {
      return (
        <tr>
          <th>№</th>
          <th onClick={() => handleSort("name")}>
            <span className={styles.headerContent}>
              Отдел
              <SortArrow active={sortField === "name"} order={sortOrder} />
            </span>
          </th>
          <th onClick={() => handleSort("totalEmployees")}>
            <span className={styles.headerContent}>
              Всего сотрудников
              <SortArrow
                active={sortField === "totalEmployees"}
                order={sortOrder}
              />
            </span>
          </th>
          <th onClick={() => handleSort("present")}>
            <span className={styles.headerContent}>
              Пришли
              <SortArrow active={sortField === "present"} order={sortOrder} />
            </span>
          </th>
          <th onClick={() => handleSort("absent")}>
            <span className={styles.headerContent}>
              Не пришли
              <SortArrow active={sortField === "absent"} order={sortOrder} />
            </span>
          </th>
          <th onClick={() => handleSort("late")}>
            <span className={styles.headerContent}>
              Опоздали
              <SortArrow active={sortField === "late"} order={sortOrder} />
            </span>
          </th>
          <th onClick={() => handleSort("inside")}>
            <span className={styles.headerContent}>
              На месте
              <SortArrow active={sortField === "inside"} order={sortOrder} />
            </span>
          </th>
          <th onClick={() => handleSort("left")}>
            <span className={styles.headerContent}>
              Ушли
              <SortArrow active={sortField === "left"} order={sortOrder} />
            </span>
          </th>
        </tr>
      );
    }

    // Дефолт — viewMode !== "branch"
    return (
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
        <th onClick={() => handleSort("totalEmployees")}>
          <span className={styles.headerContent}>
            Всего сотрудников
            <SortArrow
              active={sortField === "totalEmployees"}
              order={sortOrder}
            />
          </span>
        </th>
        <th onClick={() => handleSort("present")}>
          <span className={styles.headerContent}>
            Пришли
            <SortArrow active={sortField === "present"} order={sortOrder} />
          </span>
        </th>
        <th onClick={() => handleSort("absent")}>
          <span className={styles.headerContent}>
            Не пришли
            <SortArrow active={sortField === "absent"} order={sortOrder} />
          </span>
        </th>
        <th onClick={() => handleSort("late")}>
          <span className={styles.headerContent}>
            Опоздали
            <SortArrow active={sortField === "late"} order={sortOrder} />
          </span>
        </th>
        <th onClick={() => handleSort("inside")}>
          <span className={styles.headerContent}>
            На месте
            <SortArrow active={sortField === "inside"} order={sortOrder} />
          </span>
        </th>
        <th onClick={() => handleSort("left")}>
          <span className={styles.headerContent}>
            Ушли
            <SortArrow active={sortField === "left"} order={sortOrder} />
          </span>
        </th>
        <th>Показать по отделу</th>
      </tr>
    );
  };

  // ─── Тело таблицы ─────────────────────────────────────────────────
  const renderTbody = () => {
    if (!data?.length) {
      return (
        <tr>
          <td colSpan="11">Нет данных</td>
        </tr>
      );
    }

    if (viewMode === "branch" && displayMode === "byEmployees") {
      if (!sortedEmployees.length) {
        return (
          <tr>
            <td colSpan="11">Нет данных</td>
          </tr>
        );
      }
      return sortedEmployees.map((emp, index) => (
        <tr key={emp.employeeId}>
          <td>{index + 1}</td>
          <td>
            <div className={styles.employee}>
              {emp.employeeFullName}
              {emp.employeePhoto && (
                <img
                  src={`/api/employees/image/${emp.employeePhoto}`}
                  alt="employee"
                />
              )}
            </div>
          </td>
          <td>{emp.departmentName}</td>
          <td>{emp.positionName || "—"}</td>
          <td>{emp.present ? "✓" : "—"}</td>
          <td>{emp.absent ? "✓" : "—"}</td>
          <td>{emp.late ? `${emp.lateMinutes} мин` : "—"}</td>
          <td>{emp.inside ? "✓" : "—"}</td>
          <td>{emp.left ? "✓" : "—"}</td>
          <td>{emp.firstEntry || "—"}</td>
          <td>{emp.lastExit || "—"}</td>
        </tr>
      ));
    }

    if (viewMode === "branch" && displayMode === "byDepartments") {
      if (!sortedDepartments.length) {
        return (
          <tr>
            <td colSpan="11">Нет данных</td>
          </tr>
        );
      }
      return sortedDepartments.map((dept, index) => (
        <tr key={dept.name} onClick={() => setModalData(dept.employees)}>
          <td>{index + 1}</td>
          <td>{dept.name}</td>
          <td>{dept.totalEmployees}</td>
          <td>{dept.present}</td>
          <td>{dept.absent}</td>
          <td>{dept.late}</td>
          <td>{dept.inside}</td>
          <td>{dept.left}</td>
        </tr>
      ));
    }

    // Дефолт — фильтрация по филиалу
    const sorted = sortedBranches;
    if (!sorted.length) {
      return (
        <tr>
          <td colSpan="11">Нет данных</td>
        </tr>
      );
    }
    return sorted.map((branch, index) => (
      <>
        <tr key={branch.name} onClick={() => setModalData(branch.employees)}>
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
            className={styles.toggleCell}
          >
            <button
              className={`${styles.toggleBtn} ${openBranches[branch.name] ? styles.toggleBtnOpen : ""}`}
            >
              <span>{openBranches[branch.name] ? "Скрыть" : "Показать"}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                className={styles.toggleIcon}
              >
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="m6 9l6 6l6-6"
                />
              </svg>
            </button>
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
    ));
  };

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
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          )}
        </div>

        {/* Кнопки-фильтры по статусу — показываем только в режиме byEmployees */}
        {viewMode === "branch" && displayMode === "byEmployees" && (
          <div className={styles.statusFilters}>
            {STATUS_FILTERS.map((f) => {
              const isActive = activeFilters.has(f.key);
              return (
                <button
                  key={f.key}
                  className={`${styles.statusFilterBtn} ${isActive ? styles.statusFilterBtnActive : ""}`}
                  style={{
                    "--filter-color": f.color,
                    "--filter-bg": f.bg,
                    "--filter-active-bg": f.activeBg,
                    "--filter-border": f.border,
                  }}
                  onClick={() => toggleFilter(f.key)}
                  title={`Фильтр: ${f.label}`}
                >
                  <span className={styles.filterLabel}>{f.label}</span>
                  <span className={styles.filterBadge}>
                    {statusCounts[f.key]}
                  </span>
                </button>
              );
            })}

            {activeFilters.size > 0 && (
              <button
                className={styles.clearFiltersBtn}
                onClick={() => setActiveFilters(new Set())}
                title="Сбросить все фильтры"
              >
                × Сбросить
              </button>
            )}
          </div>
        )}

        {viewMode === "branch" && (
          <Switcher
            items={viewTypes}
            activeItem={displayMode}
            onSelect={(id) => {
              setDisplayMode(id);
              setActiveFilters(new Set()); // сбрасываем фильтры при смене режима
            }}
          />
        )}

        {Object.keys(prepareAttendanceData).length > 0 && (
          <DownloadButton text={t("save")} onClick={() => {}} />
        )}
      </div>

      {/* Активные фильтры — информационная строка */}
      {activeFilters.size > 0 && (
        <div className={styles.activeFiltersBar}>
          <span className={styles.activeFiltersLabel}>Фильтр активен:</span>
          {[...activeFilters].map((key) => {
            const f = STATUS_FILTERS.find((f) => f.key === key);
            return (
              <span
                key={key}
                className={styles.activeFilterTag}
                style={{ "--filter-color": f.color, "--filter-bg": f.bg }}
              >
                {f.icon} {f.label}
                <button
                  className={styles.removeTagBtn}
                  onClick={() => toggleFilter(key)}
                >
                  ×
                </button>
              </span>
            );
          })}
          <span className={styles.filteredCount}>
            Показано: {sortedEmployees.length}{" "}
            {sortedEmployees.length === 1
              ? "сотрудник"
              : sortedEmployees.length < 5
                ? "сотрудника"
                : "сотрудников"}
          </span>
        </div>
      )}

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>{renderThead()}</thead>
          <tbody>{renderTbody()}</tbody>
        </table>
      </div>

      <Portal isOpen={!!modalData} onClose={() => setModalData(null)}>
        <AttendanceTableByEmployee data={modalData} />
      </Portal>
    </div>
  );
};

export default AttendanceTable;
