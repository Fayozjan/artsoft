import { useState, useMemo, useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import TimesheetEventModal from "./TimesheetEventModal";
import TimesheetHeader from "./TimesheetHeader";
import TimesheetRow from "./TimesheetRow";

import styles from "./Timesheet.module.scss";
import { useTranslation } from "react-i18next";

const Timesheet = ({
  data,
  date,
  holidays,
  currentPage,
  pageSize,
  sortField,
  sortOrder,
  visibleColumns,
}) => {
  const { t } = useTranslation();
  const [year, month] = useMemo(() => {
    const [y, m] = date.split("-").map(Number);
    return [y, m];
  }, [date]);

  const daysArray = useMemo(
    () =>
      Array.from(
        { length: new Date(year, month, 0).getDate() },
        (_, i) => i + 1,
      ),
    [year, month],
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
  const [timeOffForDay, setTimeOffForDay] = useState([]);
  const [expandedEmployeeId, setExpandedEmployeeId] = useState(null);

  const sessionsMap = useMemo(() => {
    const map = new Map();
    for (const emp of data) {
      const employeeId = String(emp.employeeId);
      for (const [dayStr, session] of Object.entries(emp.sessions || {})) {
        if (!dayStr.startsWith(date)) continue;
        const day = Number(dayStr.split("-")[2]);
        if (!day) continue;

        const events = (session.events || []).map((ev) => ({
          ...ev,
          employee: emp,
        }));
        map.set(`${employeeId}-${day}`, {
          events,
          timeOff: session.timeOff,
          date: dayStr,
        });
      }
    }
    return map;
  }, [data, date]);

  const sortedEmployees = useMemo(() => {
    return [...data].sort((a, b) => {
      let aVal = a[sortField] ?? "";
      let bVal = b[sortField] ?? "";

      if (sortField === "totalWorkedDays")
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;

      if (/^\d{2}:\d{2}$/.test(aVal)) {
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

  const handleTableClick = useCallback(
    (e) => {
      const cell = e.target.closest("td");
      if (!cell) return;

      const { day, employeeId } = cell.dataset;

      if (day) {
        if (!employeeId) return;
        const item = sessionsMap.get(`${employeeId}-${day}`);
        if (!item) return;
        setEventsForDay(item.events);
        setTimeOffForDay(item.timeOff);
        setSelectedDate(item.date);
        setModalVisible(true);
      } else {
        const row = cell.closest("tr[data-employee-id]");
        if (!row) return;
        const empId = row.dataset.employeeId;
        if (!empId) return;
        setExpandedEmployeeId((prev) => (prev === empId ? null : empId));
      }
    },
    [sessionsMap],
  );

  const closeModal = useCallback(() => setModalVisible(false), []);

  const parentRef = useRef();

  const rowVirtualizer = useVirtualizer({
    count: sortedEmployees.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    measureElement: (el) => el?.getBoundingClientRect().height ?? 52,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className={styles.tableContainer}>
      <table className={styles.table} onClick={handleTableClick}>
        <TimesheetHeader
          daysArray={daysArray}
          holidayDays={holidayDays}
          year={year}
          month={month}
          visibleColumns={visibleColumns}
        />

        <tbody
          style={{
            position: "relative",
            height: `${rowVirtualizer.getTotalSize()}px`,
          }}
        >
          {sortedEmployees.length === 0 ? (
            <tr>
              <td
                colSpan={daysArray.length + 1}
                style={{
                  textAlign: "center",
                }}
              >
                {t("noData")}
              </td>
            </tr>
          ) : (
            rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const employee = sortedEmployees[virtualRow.index];
              const empId = String(employee.employeeId);
              return (
                <TimesheetRow
                  key={employee.employeeId}
                  employee={employee}
                  id={employee.employeeId}
                  index={virtualRow.index}
                  daysArray={daysArray}
                  currentPage={currentPage}
                  pageSize={pageSize}
                  virtualRow={virtualRow}
                  date={date}
                  isExpanded={expandedEmployeeId === empId}
                  measureRef={rowVirtualizer.measureElement}
                  visibleColumns={visibleColumns}
                />
              );
            })
          )}
        </tbody>
      </table>

      <TimesheetEventModal
        visible={modalVisible}
        onClose={closeModal}
        events={eventsForDay}
        timeOffs={timeOffForDay}
        date={selectedDate}
      />
    </div>
  );
};

export default Timesheet;
