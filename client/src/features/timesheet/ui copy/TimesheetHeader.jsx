import React from "react";
import dayjs from "dayjs";
import SortArrow from "../../../components/SortArrow";
import styles from "./Timesheet.module.scss";

const TimesheetHeader = React.memo(
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
          onClick={() => handleSort("employeeFullName")}
        >
          ФИО{" "}
          <SortArrow
            active={sortField === "employeeFullName"}
            order={sortOrder}
          />
        </th>
        <th onClick={() => handleSort("branchName")}>
          Филиал{" "}
          <SortArrow active={sortField === "branchName"} order={sortOrder} />
        </th>
        <th onClick={() => handleSort("departmentName")}>
          Отдел{" "}
          <SortArrow
            active={sortField === "departmentName"}
            order={sortOrder}
          />
        </th>
        <th onClick={() => handleSort("positionName")}>
          Должность{" "}
          <SortArrow active={sortField === "positionName"} order={sortOrder} />
        </th>
        <th onClick={() => handleSort("workScheduleName")}>
          Рабочий график{" "}
          <SortArrow
            active={sortField === "workScheduleName"}
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

export default TimesheetHeader;
