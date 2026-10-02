import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";

import SortArrow from "./SortArrow";
import DownloadButton from "./DownloadButton";
import AttendanceTableByEmployee from "./AttendanceTableByEmployee";
import Portal from "./Portal";
import { Switcher } from "./Switcher";
import { Icons } from "../icons/icons";

import styles from "./AttendanceTable.module.scss";
import { formatLateMinutesToHours } from "../helpers/time";
import { downloadAttendanceModeSheet } from "../utils/DocGenerator";
import { prepareAttendanceData as prepareData } from "../utils/prepareAttendanceData";
import AttendanceDisplayFilter from "./AttendanceDisplayFilter";

const STATUS_FILTERS = [
  {
    key: "present",
    labelKey: "checkedIn",
    color: "#16a34a",
    bg: "#f0fdf4",
    activeBg: "#16a34a",
    border: "#86efac",
  },
  {
    key: "absent",
    labelKey: "notCheckedIn",
    color: "#dc2626",
    bg: "#fef2f2",
    activeBg: "#dc2626",
    border: "#fca5a5",
  },
  {
    key: "late",
    labelKey: "lateGroup",
    color: "#d97706",
    bg: "#fffbeb",
    activeBg: "#d97706",
    border: "#fcd34d",
  },
  {
    key: "inside",
    labelKey: "onSite",
    color: "#2563eb",
    bg: "#eff6ff",
    activeBg: "#2563eb",
    border: "#93c5fd",
  },
  {
    key: "left",
    labelKey: "checkedOut",
    color: "#7c3aed",
    bg: "#f5f3ff",
    activeBg: "#7c3aed",
    border: "#c4b5fd",
  },
  {
    key: "onTimeOff",
    labelKey: "onCompanyTimeOff",
    color: "#0d9488",
    bg: "#f0fdfa",
    activeBg: "#0d9488",
    border: "#5eead4",
  },
];

const AttendanceTable = ({ rowData = [], viewMode }) => {
  const [sortField, setSortField] = useState("employeeFullName");
  const [sortOrder, setSortOrder] = useState("asc");
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [openBranches, setOpenBranches] = useState({});
  const [modalData, setModalData] = useState(null);
  const [displayMode, setDisplayMode] = useState(
    () => (viewMode === "branch" ? "byEmployees" : "byBranch"),
  );
  const [activeFilter, setActiveFilter] = useState(null);
  const emptyTableFilter = () => ({ branches: [], departments: [], employees: [], positions: [] });
  const [tableFilter, setTableFilter] = useState(emptyTableFilter);
  const viewTypes =
    viewMode === "branch"
      ? ["byEmployees", "byDepartments"]
      : ["byBranch", "byDepartments", "byEmployees"];


  // Переключение фильтра: если уже активен — снять, иначе выбрать только его (single-select)
  const toggleFilter = (key) => {
    setActiveFilter((prev) => (prev === key ? null : key));
  };

  const data = useMemo(
    () => prepareData(rowData, { noBranch: t("noBranch"), noDepartment: t("noDepartment") }),
    [rowData],
  );

  const allEmployees = useMemo(
    () => data.flatMap((branch) => branch.employees),
    [data],
  );

  const allDepartments = useMemo(
    () =>
      data.flatMap((branch) =>
        branch.departments.map((dept) => ({ ...dept, branchName: branch.name })),
      ),
    [data],
  );

  // Применяем фильтры по статусу к массиву сотрудников
  const applyStatusFilter = (employees) => {
    if (!activeFilter) return employees;
    return employees.filter((emp) => emp[activeFilter] === true);
  };

  const filteredEmployees = useMemo(() => {
    let result = allEmployees;
    if (tableFilter.branches.length) result = result.filter((e) => tableFilter.branches.includes(e.branchName));
    if (tableFilter.departments.length) result = result.filter((e) => tableFilter.departments.includes(e.departmentName));
    if (tableFilter.employees.length) result = result.filter((e) => tableFilter.employees.includes(e.employeeId));
    if (tableFilter.positions.length) result = result.filter((e) => tableFilter.positions.includes(e.positionName));
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (emp) =>
          emp.employeeFullName?.toLowerCase().includes(q) ||
          emp.departmentName?.toLowerCase().includes(q) ||
          emp.positionName?.toLowerCase().includes(q) ||
          emp.branchName?.toLowerCase().includes(q),
      );
    }
    return applyStatusFilter(result);
  }, [allEmployees, search, activeFilter, tableFilter]);

  const filteredDepartments = useMemo(() => {
    let result = allDepartments;
    if (tableFilter.branches.length) result = result.filter((d) => tableFilter.branches.includes(d.branchName));
    if (tableFilter.departments.length) result = result.filter((d) => tableFilter.departments.includes(d.name));
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (dept) =>
          dept.name?.toLowerCase().includes(q) ||
          dept.branchName?.toLowerCase().includes(q),
      );
    }
    return result;
  }, [allDepartments, search, tableFilter]);

  const filteredBranches = useMemo(() => {
    let result = data;
    if (tableFilter.branches.length) result = result.filter((b) => tableFilter.branches.includes(b.name));
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((branch) => branch.name?.toLowerCase().includes(q));
    }
    return result;
  }, [data, search, tableFilter]);

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

  const sortedDepartments = useMemo(
    () => getSortedData(filteredDepartments),
    [filteredDepartments, sortField, sortOrder],
  );

  const sortedBranches = useMemo(
    () => getSortedData(filteredBranches),
    [filteredBranches, sortField, sortOrder],
  );

  const tableContainerRef = useRef(null);
  const rowVirtualizer = useVirtualizer({
    count: displayMode === "byEmployees" ? sortedEmployees.length : 0,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 50,
    overscan: 8,
  });

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

  useEffect(() => {
    if (displayMode === "byEmployees") {
      setSortField("employeeFullName");
    } else {
      setSortField("name");
    }
    setSortOrder("asc");
  }, [displayMode]);

  // ─── Подсчёт для бейджей на кнопках ──────────────────────────────
  const statusCounts = useMemo(() => {
    const counts = {};
    STATUS_FILTERS.forEach(({ key }) => {
      counts[key] = allEmployees.filter((emp) => emp[key] === true).length;
    });
    return counts;
  }, [allEmployees]);

  // ─── Фиксированные ширины колонок для виртуального скролла ──────
  // Порядок: №, [филиал], отдел, ФИО, должность, пришел, опоздал, на месте, ушел
  const renderColgroup = () => {
    if (displayMode !== "byEmployees") return null;
    if (viewMode === "branch") {
      return (
        <colgroup>
          <col style={{ width: "4.55%" }} />   {/* № */}
          <col style={{ width: "14.77%" }} />  {/* отдел */}
          <col style={{ width: "25%" }} />     {/* ФИО */}
          <col style={{ width: "14.77%" }} />  {/* должность */}
          <col style={{ width: "9.66%" }} />   {/* пришел */}
          <col style={{ width: "13.64%" }} />  {/* турникет */}
          <col style={{ width: "7.95%" }} />   {/* опоздал */}
          <col style={{ width: "9.66%" }} />   {/* ушел */}
        </colgroup>
      );
    }
    return (
      <colgroup>
        <col style={{ width: "4.17%" }} />   {/* № */}
        <col style={{ width: "12.5%" }} />   {/* филиал */}
        <col style={{ width: "12.5%" }} />   {/* отдел */}
        <col style={{ width: "20.83%" }} />  {/* ФИО */}
        <col style={{ width: "12.5%" }} />   {/* должность */}
        <col style={{ width: "8.85%" }} />   {/* пришел */}
        <col style={{ width: "12.5%" }} />   {/* турникет */}
        <col style={{ width: "7.29%" }} />   {/* опоздал */}
        <col style={{ width: "8.85%" }} />   {/* ушел */}
      </colgroup>
    );
  };

  // ─── Заголовки таблицы ────────────────────────────────────────────
  const renderThead = () => {
    if (displayMode === "byEmployees") {
      return (
        <tr>
          <th>№</th>
          {viewMode !== "branch" && (
            <th onClick={() => handleSort("branchName")}>
              <span className={styles.headerContent}>
                {t("branch")}
                <SortArrow
                  active={sortField === "branchName"}
                  order={sortOrder}
                />
              </span>
            </th>
          )}
          <th onClick={() => handleSort("departmentName")}>
            <span className={styles.headerContent}>
              {t("department")}
              <SortArrow
                active={sortField === "departmentName"}
                order={sortOrder}
              />
            </span>
          </th>
          <th onClick={() => handleSort("employeeFullName")}>
            <span className={styles.headerContent}>
              {t("fullName")}
              <SortArrow
                active={sortField === "employeeFullName"}
                order={sortOrder}
              />
            </span>
          </th>
          <th onClick={() => handleSort("positionName")}>
            <span className={styles.headerContent}>
              {t("position")}
              <SortArrow
                active={sortField === "positionName"}
                order={sortOrder}
              />
            </span>
          </th>
          <th onClick={() => handleSort("firstEntry")}>
            <span className={styles.headerContent}>
              {t("checkedInSingular")}
              <SortArrow active={sortField === "firstEntry"} order={sortOrder} />
            </span>
          </th>
          <th onClick={() => handleSort("firstEntryDoor")}>
            <span className={styles.headerContent}>
              {t("turnstile")}
              <SortArrow active={sortField === "firstEntryDoor"} order={sortOrder} />
            </span>
          </th>
          <th onClick={() => handleSort("lateMinutes")}>
            <span className={styles.headerContent}>
              {t("lateTimeHhMm")}
              <SortArrow active={sortField === "lateMinutes"} order={sortOrder} />
            </span>
          </th>
          <th onClick={() => handleSort("lastExit")}>
            <span className={styles.headerContent}>
              {t("checkedOutSingular")}
              <SortArrow active={sortField === "lastExit"} order={sortOrder} />
            </span>
          </th>
        </tr>
      );
    }

    if (displayMode === "byDepartments") {
      return (
        <tr>
          <th>№</th>
          {viewMode !== "branch" && (
            <th onClick={() => handleSort("branchName")}>
              <span className={styles.headerContent}>
                {t("branch")}
                <SortArrow active={sortField === "branchName"} order={sortOrder} />
              </span>
            </th>
          )}
          <th onClick={() => handleSort("name")}>
            <span className={styles.headerContent}>
              {t("department")}
              <SortArrow active={sortField === "name"} order={sortOrder} />
            </span>
          </th>
          <th onClick={() => handleSort("totalEmployees")}>
            <span className={styles.headerContent}>
              {t("totalEmployeesHeader")}
              <SortArrow
                active={sortField === "totalEmployees"}
                order={sortOrder}
              />
            </span>
          </th>
          <th onClick={() => handleSort("present")}>
            <span className={styles.headerContent}>
              {t("checkedIn")}
              <SortArrow active={sortField === "present"} order={sortOrder} />
            </span>
          </th>
          <th onClick={() => handleSort("absent")}>
            <span className={styles.headerContent}>
              {t("notCheckedIn")}
              <SortArrow active={sortField === "absent"} order={sortOrder} />
            </span>
          </th>
          <th onClick={() => handleSort("late")}>
            <span className={styles.headerContent}>
              {t("lateGroup")}
              <SortArrow active={sortField === "late"} order={sortOrder} />
            </span>
          </th>
          <th onClick={() => handleSort("inside")}>
            <span className={styles.headerContent}>
              {t("onSite")}
              <SortArrow active={sortField === "inside"} order={sortOrder} />
            </span>
          </th>
          <th onClick={() => handleSort("left")}>
            <span className={styles.headerContent}>
              {t("checkedOut")}
              <SortArrow active={sortField === "left"} order={sortOrder} />
            </span>
          </th>
        </tr>
      );
    }

    // byBranch — дефолт
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
            {t("totalEmployeesHeader")}
            <SortArrow
              active={sortField === "totalEmployees"}
              order={sortOrder}
            />
          </span>
        </th>
        <th onClick={() => handleSort("present")}>
          <span className={styles.headerContent}>
            {t("checkedIn")}
            <SortArrow active={sortField === "present"} order={sortOrder} />
          </span>
        </th>
        <th onClick={() => handleSort("absent")}>
          <span className={styles.headerContent}>
            {t("notCheckedIn")}
            <SortArrow active={sortField === "absent"} order={sortOrder} />
          </span>
        </th>
        <th onClick={() => handleSort("late")}>
          <span className={styles.headerContent}>
            {t("lateGroup")}
            <SortArrow active={sortField === "late"} order={sortOrder} />
          </span>
        </th>
        <th onClick={() => handleSort("inside")}>
          <span className={styles.headerContent}>
            {t("onSite")}
            <SortArrow active={sortField === "inside"} order={sortOrder} />
          </span>
        </th>
        <th onClick={() => handleSort("left")}>
          <span className={styles.headerContent}>
            {t("checkedOut")}
            <SortArrow active={sortField === "left"} order={sortOrder} />
          </span>
        </th>
        {viewMode !== "branch" && <th>{t("showByDept")}</th>}
      </tr>
    );
  };

  // ─── Тело таблицы ─────────────────────────────────────────────────
  const renderTbody = () => {
    if (!data?.length) {
      return (
        <tr>
          <td colSpan="11">{t("noData")}</td>
        </tr>
      );
    }

    if (displayMode === "byEmployees") {
      if (!sortedEmployees.length) {
        return (
          <tr>
            <td colSpan="11">{t("noData")}</td>
          </tr>
        );
      }
      const virtualRows = rowVirtualizer.getVirtualItems();
      const totalSize = rowVirtualizer.getTotalSize();
      const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
      const paddingBottom =
        virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;
      return (
        <>
          {paddingTop > 0 && (
            <tr>
              <td colSpan={9} style={{ height: paddingTop, padding: 0, border: 0 }} />
            </tr>
          )}
          {virtualRows.map((virtualRow) => {
            const emp = sortedEmployees[virtualRow.index];
            return (
              <tr key={emp.employeeId} style={{ height: 50 }}>
                <td>{virtualRow.index + 1}</td>
                {viewMode !== "branch" && <td>{emp.branchName || "—"}</td>}
                <td>{emp.departmentName}</td>
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
                <td>{emp.positionName || "—"}</td>
                <td>{emp.firstEntry || ""}</td>
                <td>
                  {emp.firstEntryDoor ? (
                    emp.firstEntryDoor
                  ) : emp.timeOffInfo ? (
                    <span>
                      {t("excusedLeave")}
                      {emp.timeOffInfo.reason ? ` (${emp.timeOffInfo.reason})` : ""}
                    </span>
                  ) : (
                    ""
                  )}
                </td>
                <td>{emp.late ? formatLateMinutesToHours(emp.lateMinutes) : ""}</td>
                <td>{emp.lastExit || ""}</td>
              </tr>
            );
          })}
          {paddingBottom > 0 && (
            <tr>
              <td colSpan={9} style={{ height: paddingBottom, padding: 0, border: 0 }} />
            </tr>
          )}
        </>
      );
    }

    if (displayMode === "byDepartments") {
      if (!sortedDepartments.length) {
        return (
          <tr>
            <td colSpan="11">{t("noData")}</td>
          </tr>
        );
      }
      return sortedDepartments.map((dept, index) => (
        <tr key={`${dept.branchName}-${dept.name}`} onClick={() => setModalData(dept.employees)}>
          <td>{index + 1}</td>
          {viewMode !== "branch" && <td>{dept.branchName || "—"}</td>}
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

    // byBranch — дефолт
    if (!sortedBranches.length) {
      return (
        <tr>
          <td colSpan="11">{t("noData")}</td>
        </tr>
      );
    }
    return sortedBranches.map((branch, index) => (
      <Fragment key={branch.name}>
        <tr onClick={() => setModalData(branch.employees)}>
          <td>{index + 1}</td>
          <td>{branch.name}</td>
          <td>{branch.totalEmployees}</td>
          <td>{branch.present}</td>
          <td>{branch.absent}</td>
          <td>{branch.late}</td>
          <td>{branch.inside}</td>
          <td>{branch.left}</td>
          {viewMode !== "branch" && (
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
                <span>{openBranches[branch.name] ? t("hide") : t("show")}</span>
                <span className={styles.toggleIcon}>{Icons.chevronDown}</span>
              </button>
            </td>
          )}
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
              {viewMode !== "branch" && <td></td>}
            </tr>
          ))}
      </Fragment>
    ));
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.searchInput}>
          {Icons.search}
          <input
            type="text"
            placeholder={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <span className={styles.clearBtn} onClick={() => setSearch("")} style={{ display: "flex", cursor: "pointer" }}>{Icons.clear}</span>
          )}
        </div>

        {/* Кнопки-фильтры по статусу — показываем только в режиме byEmployees */}
        {displayMode === "byEmployees" && (
          <div className={styles.statusFilters}>
            {STATUS_FILTERS.map((f) => {
              const isActive = activeFilter === f.key;
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
                  title={t("filterActive") + " " + t(f.labelKey)}
                >
                  <span className={styles.filterLabel}>{t(f.labelKey)}</span>
                  <span className={styles.filterBadge}>
                    {statusCounts[f.key]}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {data.length > 0 && (
            <AttendanceDisplayFilter
              data={data}
              displayMode={displayMode}
              filter={tableFilter}
              onApply={setTableFilter}
            />
          )}

          <Switcher
            items={viewTypes}
            activeItem={displayMode}
            onSelect={(id) => {
              setDisplayMode(id);
              setActiveFilter(null);
              setTableFilter(emptyTableFilter());
            }}
          />

          {data.length > 0 && (
            <DownloadButton
              text={t("save")}
              onClick={() => {
                const rows =
                  displayMode === "byBranch"
                    ? sortedBranches
                    : displayMode === "byDepartments"
                      ? sortedDepartments
                      : [...sortedEmployees].sort(
                          (a, b) =>
                            (a.positionSortOrder ?? 0) - (b.positionSortOrder ?? 0) ||
                            (a.departmentName || "").localeCompare(b.departmentName || "", "ru", { sensitivity: "base" }),
                        );
                downloadAttendanceModeSheet(rows, displayMode, new Date().toISOString().slice(0, 10));
              }}
            />
          )}
        </div>
      </div>

      <div className={styles.tableContainer} ref={tableContainerRef}>
        <table
          className={`${styles.table} ${displayMode === "byEmployees" ? styles.tableFixed : ""}`}
        >
          {renderColgroup()}
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
