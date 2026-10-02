import { useState, useMemo, useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import TimesheetEventModal from "./TimesheetEventModal";
import TimesheetHeader from "./TimesheetHeader";
import TimesheetRow from "./TimesheetRow";
import { sortTimesheetEmployees } from "../../../utils/sortTimesheetEmployees";

import styles from "./Timesheet.module.scss";
import { useTranslation } from "react-i18next";

const Timesheet = ({
  data,
  date,
  weekDays,
  calendar,
  currentPage,
  pageSize,
  sortField,
  sortOrder,
  visibleColumns,
  onScroll,
}) => {
  const { t } = useTranslation();
  const [year, month] = useMemo(() => {
    const [y, m] = date.split("-").map(Number);
    return [y, m];
  }, [date]);

  const daysArray = useMemo(() => {
    if (weekDays?.length) return weekDays;
    return Array.from(
      { length: new Date(year, month, 0).getDate() },
      (_, i) => i + 1,
    );
  }, [year, month, weekDays]);

  // Пометки производственного календаря по номеру дня месяца:
  // праздник / доп. выходной / сокращённый — подсвечивают всю колонку
  const calendarByDay = useMemo(() => {
    const map = new Map();
    (calendar || []).forEach((d) => {
      const day = Number(String(d.date).split("-")[2]);
      if (day) map.set(day, d);
    });
    return map;
  }, [calendar]);

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

  const sortedEmployees = useMemo(
    () => sortTimesheetEmployees(data, sortField, sortOrder),
    [data, sortField, sortOrder],
  );

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
    <div ref={parentRef} className={styles.tableContainer} onScroll={onScroll}>
      <table
        className={`${styles.table} ${weekDays?.length ? styles.weekTable : ""}`}
        onClick={handleTableClick}
      >
        <TimesheetHeader
          daysArray={daysArray}
          calendarByDay={calendarByDay}
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
                  calendarByDay={calendarByDay}
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
