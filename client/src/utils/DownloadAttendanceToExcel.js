import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import i18n from "../i18n";
import { formatMinutesToHours } from "./date";

const getMonthName = (month) => i18n.t(`months.${month}`);

const getBaseHeaders = () => [
  i18n.t("branch"),
  i18n.t("department"),
  i18n.t("fullName"),
  i18n.t("employeeNumber"),
  i18n.t("position"),
  i18n.t("pinfl"),
  i18n.t("workSchedule"),
  i18n.t("lateHours"),
  i18n.t("overtimeHours"),
  i18n.t("paidTimeOff"),
  i18n.t("workedDays"),
  i18n.t("workedHours"),
  `${i18n.t("total")} (${i18n.t("hoursShort")}:${i18n.t("minutesShort")})`,
];

const getEmployeeBaseRow = (employee) => {
  const {
    employeeFullName,
    employeeId,
    branchName,
    departmentName,
    positionName,
    pinfl,
    workScheduleName,
    totalLateTime,
    totalOvertimeMinutes,
    totalPaidTimeOffDays,
    totalPaidTimeOffMinutes,
    totalWorkedDays,
    totalScheduledDays,
    totalWorkedHours,
    totalScheduledMinutes,
  } = employee;

  return [
    branchName ?? "",
    departmentName ?? "",
    employeeFullName ?? "",
    employeeId ?? "",
    positionName ?? "",
    pinfl ?? "",
    workScheduleName ?? "",
    totalLateTime
      ? `${totalLateTime} ${i18n.t("hoursShort")}`
      : `00:00 ${i18n.t("hoursShort")}`,
    `${formatMinutesToHours(totalOvertimeMinutes)} ${i18n.t("hoursShort")}`,
    `${totalPaidTimeOffDays ?? 0} / ${formatMinutesToHours(totalPaidTimeOffMinutes ?? 0)} ${i18n.t("hoursShort")}`,
    `${totalWorkedDays ?? 0} / ${totalScheduledDays ?? 0}`,
    totalWorkedHours
      ? `${totalWorkedHours} / ${formatMinutesToHours(totalScheduledMinutes)}`
      : "00:00",
  ];
};

const BASE_COLS_COUNT = 13;

const applyStyles = (worksheet, daysInMonth) => {
  const thinBorder = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };

  const range = XLSX.utils.decode_range(worksheet["!ref"]);

  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      if (!worksheet[cellAddress]) continue;

      worksheet[cellAddress].s = {
        border: thinBorder,
        alignment: {
          wrapText: true,
          vertical: "center",
          horizontal: "center",
        },
        font: { sz: 10 },
      };

      if (R === 0) {
        worksheet[cellAddress].s.font = { bold: true, sz: 10 };
        worksheet[cellAddress].s.fill = { fgColor: { rgb: "EEEEEE" } };
      }

      if (C >= BASE_COLS_COUNT && R > 0) {
        worksheet[cellAddress].s.alignment.vertical = "top";
      }
    }
  }
};

const getColWidths = (headers, excelData, dayColWidth, daysInMonth) => {
  const baseColWidths = headers.slice(0, BASE_COLS_COUNT).map((header, colIndex) => {
    const maxLength = excelData.reduce((max, row) => {
      const cellValue = row[colIndex] ? row[colIndex].toString() : "";
      return Math.max(max, cellValue.length);
    }, header.length);

    return { wch: maxLength + 2 };
  });

  return [...baseColWidths, ...Array(daysInMonth).fill({ wch: dayColWidth })];
};

export const downloadFullAttendanceToExcel = (data, date) => {
  if (!date || typeof date !== "string") return;
  if (!data || !data.length) return;

  const [year, month] = date.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  const headers = [
    ...getBaseHeaders(),
    ...Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`),
  ];

  const excelData = [headers];

  data.forEach((employee) => {
    const { sessions } = employee;

    const dayCells = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const session = sessions?.[dateStr];

      if (session && session.events && session.events.length > 0) {
        const allEventsTime = session.events
          .map((event) => {
            if (!event.parsedDate) return "--:--";
            const timePart = event.parsedDate.split("T")[1];
            const [hours, minutes] = timePart.split(":");
            const time = `${hours}:${minutes}`;
            const door = event.doorName ? ` (${event.doorName})` : "";
            return `${time}${door}`;
          })
          .join("\r\n"); // Каждый вход/выход будет на новой строке

        const cellContent = `${allEventsTime}\r\n----------\r\n${i18n.t("total")}: ${session.workDuration || "00:00"}`;
        dayCells.push(cellContent);
      } else {
        dayCells.push("");
      }
    }

    excelData.push([...getEmployeeBaseRow(employee), ...dayCells]);
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(excelData);

  worksheet["!cols"] = getColWidths(headers, excelData, 14, daysInMonth);
  applyStyles(worksheet, daysInMonth);

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    `${getMonthName(month)} ${year}`,
  );

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(blob, `attendance_detailed_${date}.xlsx`);
};

export const downloadAttendanceToExcel = (data, date) => {
  if (!date || typeof date !== "string") {
    console.error("Ошибка: параметр 'date' не передан", date);
    return;
  }
  if (!data || !data.length) return;

  const [year, month] = date.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  const headers = [
    ...getBaseHeaders(),
    ...Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`),
  ];

  const excelData = [headers];

  // Сортировка
  const sortedData = [...data].sort((a, b) => {
    return (
      (a.branchName || "").localeCompare(b.branchName || "", "ru") ||
      (a.departmentName || "").localeCompare(b.departmentName || "", "ru") ||
      (a.employeeFullName || "").localeCompare(b.employeeFullName || "", "ru")
    );
  });

  sortedData.forEach((employee) => {
    const { sessions } = employee;

    const dayCells = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const session = sessions?.[dateStr];

      if (session && session.firstEntry) {
        const entry = session.firstEntry || "-";
        const exit = session.lastExit || "-";
        const duration = session.workDuration || "00:00";

        dayCells.push(`${entry}\r\n${exit}\r\n${duration}`);
      } else {
        dayCells.push("");
      }
    }

    excelData.push([...getEmployeeBaseRow(employee), ...dayCells]);
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(excelData);

  worksheet["!cols"] = getColWidths(headers, excelData, 6, daysInMonth);
  applyStyles(worksheet, daysInMonth);

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    `${getMonthName(month)} ${year}`,
  );

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(blob, `attendance_${date}.xlsx`);
};
