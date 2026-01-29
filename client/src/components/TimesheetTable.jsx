import React, { useState, useMemo, useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import dayjs from "dayjs";

import SortArrow from "./SortArrow";
import TimesheetEventModal from "./TimesheetEventModal";
import styles from "./TimesheetTable.module.scss";

const SessionCell = React.memo(({ day, dayData, employeeId }) => (
  <td
    className={`${styles.cell} cell ${
      dayData?.hasPermission ? styles.cellGreen : ""
    }`}
    data-employee-id={employeeId}
    data-day={day}
  >
    {[dayData?.firstEntry, dayData?.lastExit, dayData?.workDuration].join("\n")}
  </td>
));

const TableHeader = React.memo(
  ({
    daysArray,
    holidayDays,
    handleSort,
    sortField,
    sortOrder,
    year,
    month,
  }) => (
    <thead>
      <tr>
        <th className={`${styles.sticky} ${styles.stickyHeader}`}>№</th>
        <th
          className={`${styles.stickyName} ${styles.stickyHeader}`}
          onClick={() => handleSort("employee_full_name")}
        >
          ФИО{" "}
          <SortArrow
            active={sortField === "employee_full_name"}
            order={sortOrder}
          />
        </th>
        <th onClick={() => handleSort("branch_name")}>
          Филиал{" "}
          <SortArrow active={sortField === "branch_name"} order={sortOrder} />
        </th>
        <th onClick={() => handleSort("department_name")}>
          Отдел{" "}
          <SortArrow
            active={sortField === "department_name"}
            order={sortOrder}
          />
        </th>
        <th onClick={() => handleSort("position_name")}>
          Должность{" "}
          <SortArrow active={sortField === "position_name"} order={sortOrder} />
        </th>
        <th onClick={() => handleSort("work_schedule_name")}>
          Рабочий график{" "}
          <SortArrow
            active={sortField === "work_schedule_name"}
            order={sortOrder}
          />
        </th>
        <th onClick={() => handleSort("totalWorkedDays")}>
          Отработано дней{" "}
          <SortArrow
            active={sortField === "totalWorkedDays"}
            order={sortOrder}
          />
        </th>
        <th onClick={() => handleSort("totalWorkedHours")}>
          Отработано часов{" "}
          <SortArrow
            active={sortField === "totalWorkedHours"}
            order={sortOrder}
          />
        </th>
        {daysArray.map((day) => {
          const dateObj = dayjs(
            `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
              2,
              "0"
            )}`
          );
          const isSunday = dateObj.day() === 0;
          return (
            <th
              key={day}
              className={`${styles.th_with_icon} ${
                isSunday ? styles.sunday : ""
              }`}
            >
              {day}
              {holidayDays.has(day) && (
                <span className={styles.holiday_icon}>⭐</span>
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  )
);

const EmployeeRow = React.memo(
  ({ employee, id, daysArray, index, currentPage, pageSize, virtualRow }) => (
    <tr
      key={employee.id}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        minWidth: "max-content",
        transform: `translateY(${virtualRow.start}px)`,
      }}
    >
      <td className={styles.sticky}>
        {(currentPage - 1) * pageSize + index + 1}
      </td>
      <td className={styles.stickyName}>{employee?.employeeFullName}</td>
      <td>{employee?.branchName}</td>
      <td>{employee?.departmentName}</td>
      <td>{employee?.positionName}</td>
      <td>{employee?.workScheduleName}</td>
      <td>{employee?.totalWorkedDays || 0}</td>
      <td>{employee?.totalWorkedHours || 0}</td>
      {daysArray.map((day) => (
        <SessionCell
          key={day}
          day={day}
          dayData={employee.sessions[day]}
          employeeId={id}
        />
      ))}
    </tr>
  )
);

const TimesheetTable = ({ data, date, holidays, currentPage, pageSize }) => {
  const year = useMemo(() => Number(date.split("-")[0]), [date]);
  const month = useMemo(() => Number(date.split("-")[1]), [date]);

  const [sortField, setSortField] = useState("employee_full_name");
  const [sortOrder, setSortOrder] = useState("asc");

  const daysArray = useMemo(
    () =>
      Array.from(
        { length: new Date(year, month, 0).getDate() },
        (_, i) => i + 1
      ),
    [year, month]
  );

  const holidayDays = useMemo(() => {
    const set = new Set();
    holidays.forEach((h) => {
      const from = new Date(h.date_from).getUTCDate();
      const to = new Date(h.date_to).getUTCDate();
      for (let d = from; d <= to; d++) set.add(d);
    });
    return set;
  }, [holidays]);

  const [selectedDate, setSelectedDate] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [eventsForDay, setEventsForDay] = useState([]);

  const sessionsMap = useMemo(() => {
    const map = new Map();
    for (const emp of data) {
      const employeeId = String(emp.employeeId);
      for (const [dayStr, session] of Object.entries(emp.sessions || {})) {
        const day = Number(dayStr);
        const events = (session.events || []).map((ev) => ({
          ...ev,
          employee: emp,
          event_time_string: ev.date,
          door_name: ev.door_name ?? "",
          event_photo: ev.event_photo ?? null,
        }));
        map.set(`${employeeId}-${day}`, {
          employeeId,
          day,
          employee: emp,
          session,
          events,
          date: dayStr,
        });
      }
    }
    return map;
  }, [data]);

  const handleCellClick = useCallback(
    (e) => {
      const cell = e.target.closest(".cell");
      if (!cell) return;
      const { employeeId, day } = cell.dataset;
      const item = sessionsMap.get(`${employeeId}-${day}`);
      if (!item) return;
      setEventsForDay(item.events);
      setSelectedDate(item.date);
      setModalVisible(true);
    },
    [sessionsMap]
  );

  const closeModal = useCallback(() => setModalVisible(false), []);

  const getSortedEmployees = useCallback(() => {
    return [...data].sort((a, b) => {
      let aVal, bVal;
      if (sortField === "employee_full_name") {
        aVal = a.employee_full_name || "";
        bVal = b.employee_full_name || "";
      } else if (sortField === "branch_name") {
        aVal = a.branch_name || "";
        bVal = b.branch_name || "";
      } else if (sortField === "department_name") {
        aVal = a.department_name || "";
        bVal = b.department_name || "";
      } else if (sortField === "position_name") {
        aVal = a.position_name || "";
        bVal = b.position_name || "";
      } else if (sortField === "work_schedule_name") {
        aVal = a.work_schedule_name || "";
        bVal = b.work_schedule_name || "";
      } else if (sortField === "totalWorkedHours") {
        aVal = a.totalWorkedHours || "00:00";
        bVal = b.totalWorkedHours || "00:00";
      } else if (sortField === "totalWorkedDays") {
        aVal = a.totalWorkedDays || 0;
        bVal = b.totalWorkedDays || 0;
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }

      if (
        typeof aVal === "string" &&
        typeof bVal === "string" &&
        /^\d{2}:\d{2}$/.test(aVal)
      ) {
        const [ah, am] = aVal.split(":").map(Number);
        const [bh, bm] = bVal.split(":").map(Number);
        return sortOrder === "asc"
          ? ah * 60 + am - (bh * 60 + bm)
          : bh * 60 + bm - (ah * 60 + am);
      }

      return sortOrder === "asc"
        ? String(aVal).localeCompare(String(bVal), "ru", {
            sensitivity: "base",
          })
        : String(bVal).localeCompare(String(aVal), "ru", {
            sensitivity: "base",
          });
    });
  }, [data, sortField, sortOrder]);

  const handleSort = (field) => {
    if (sortField === field)
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const parentRef = useRef();

  const sortedEmployees = getSortedEmployees();

  const rowVirtualizer = useVirtualizer({
    count: sortedEmployees.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 10,
  });

  return (
    <div ref={parentRef} className={styles.tableContainer}>
      <table className={styles.table} onClick={handleCellClick}>
        <TableHeader
          daysArray={daysArray}
          holidayDays={holidayDays}
          handleSort={handleSort}
          sortField={sortField}
          sortOrder={sortOrder}
          year={year}
          month={month}
        />

        <tbody
          style={{
            height: rowVirtualizer.getTotalSize(),
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const employee = sortedEmployees[virtualRow.index];
            return (
              <EmployeeRow
                employee={employee}
                id={employee.employeeId}
                index={virtualRow.index}
                daysArray={daysArray}
                currentPage={currentPage}
                pageSize={pageSize}
                virtualRow={virtualRow}
              />
            );
          })}
        </tbody>
      </table>

      <TimesheetEventModal
        visible={modalVisible}
        onClose={closeModal}
        events={eventsForDay}
        date={selectedDate}
      />
    </div>
  );
};

export default TimesheetTable;
