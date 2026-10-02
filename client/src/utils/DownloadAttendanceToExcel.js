import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";
import i18n from "../i18n";
import { formatMinutesToHours } from "./date";
import { sortTimesheetEmployees } from "./sortTimesheetEmployees";

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
    totalLateCount,
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
    `${totalLateCount ?? 0} / ${totalLateTime || "00:00"} ${i18n.t("hoursShort")}`,
    `${formatMinutesToHours(totalOvertimeMinutes)} ${i18n.t("hoursShort")}`,
    `${totalPaidTimeOffDays ?? 0} / ${formatMinutesToHours(totalPaidTimeOffMinutes ?? 0)} ${i18n.t("hoursShort")}`,
    `${totalWorkedDays ?? 0} / ${totalScheduledDays ?? 0}`,
    totalWorkedHours
      ? `${totalWorkedHours} / ${formatMinutesToHours(totalScheduledMinutes)}`
      : "00:00",
  ];
};

const BASE_COLS_COUNT = 12;

const applyStyles = (worksheet) => {
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

export const downloadFullAttendanceToExcel = (
  data,
  date,
  sortField,
  sortOrder,
  weekDays,
) => {
  if (!date || typeof date !== "string") return;
  if (!data || !data.length) return;

  const [year, month] = date.split("-").map(Number);
  const days = weekDays?.length
    ? weekDays
    : Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => i + 1);

  const headers = [...getBaseHeaders(), ...days.map((d) => `${d}`)];

  const excelData = [headers];

  const sortedData = sortTimesheetEmployees(data, sortField, sortOrder);

  sortedData.forEach((employee) => {
    const { sessions } = employee;

    const dayCells = [];

    for (const day of days) {
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

  worksheet["!cols"] = getColWidths(headers, excelData, 14, days.length);
  applyStyles(worksheet);

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    `${getMonthName(month)} ${year}`,
  );

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(blob, `attendance_detailed_${date}.xlsx`);
};

export const downloadAttendanceToExcel = (
  data,
  date,
  sortField,
  sortOrder,
  weekDays,
) => {
  if (!date || typeof date !== "string") {
    console.error("Ошибка: параметр 'date' не передан", date);
    return;
  }
  if (!data || !data.length) return;

  const [year, month] = date.split("-").map(Number);
  const days = weekDays?.length
    ? weekDays
    : Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => i + 1);

  const headers = [...getBaseHeaders(), ...days.map((d) => `${d}`)];

  const excelData = [headers];

  const sortedData = sortTimesheetEmployees(data, sortField, sortOrder);

  sortedData.forEach((employee) => {
    const { sessions } = employee;

    const dayCells = [];

    for (const day of days) {
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

  worksheet["!cols"] = getColWidths(headers, excelData, 6, days.length);
  applyStyles(worksheet);

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    `${getMonthName(month)} ${year}`,
  );

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(blob, `attendance_${date}.xlsx`);
};

const LATENESS_SUB_COLS = 4; // Пришел | Ушел | Опоздание | Сверхурочные

const applyLatenessStyles = (worksheet, branchHeaderRows) => {
  const thinBorder = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };
  const branchRowSet = new Set(branchHeaderRows);
  const range = XLSX.utils.decode_range(worksheet["!ref"]);

  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      if (!worksheet[cellAddress]) continue;

      worksheet[cellAddress].s = {
        border: thinBorder,
        alignment: { wrapText: true, vertical: "center", horizontal: "center" },
        font: { sz: 10 },
      };

      if (R <= 1) {
        worksheet[cellAddress].s.font = { bold: true, sz: 10 };
        worksheet[cellAddress].s.fill = { fgColor: { rgb: "EEEEEE" } };
      }

      if (branchRowSet.has(R)) {
        worksheet[cellAddress].s.font = { bold: true, sz: 11 };
        worksheet[cellAddress].s.fill = { fgColor: { rgb: "DDDDDD" } };
      }
    }
  }
};

// Приход/уход/опоздание/переработка по дням, сгруппировано по филиалу.
// weekDays — дни месяца, отображаемые в текущем фильтре страницы (неделя),
// если null/пусто — берутся все дни месяца, как в остальных форматах скачивания.
export const downloadLatenessAttendanceToExcel = (
  data,
  date,
  sortField,
  sortOrder,
  weekDays,
) => {
  if (!date || typeof date !== "string") return;
  if (!data || !data.length) return;

  const [year, month] = date.split("-").map(Number);
  const days = weekDays?.length
    ? weekDays
    : Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => i + 1);

  const baseHeaders = [i18n.t("department"), i18n.t("fullName"), i18n.t("position")];
  const subHeaders = [
    i18n.t("cameAt"),
    i18n.t("leftAt"),
    i18n.t("lateness"),
    i18n.t("overtimeShort"),
  ];
  const colCount = baseHeaders.length + days.length * LATENESS_SUB_COLS + 1;

  const headerRow1 = [...baseHeaders];
  const headerRow2 = baseHeaders.map(() => "");

  days.forEach((day) => {
    const label = `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
    headerRow1.push(label, "", "", "");
    headerRow2.push(...subHeaders);
  });

  headerRow1.push(i18n.t("totalShort"));
  headerRow2.push(i18n.t("lateness"));

  const excelData = [headerRow1, headerRow2];
  const merges = [];

  for (let c = 0; c < baseHeaders.length; c++) {
    merges.push({ s: { r: 0, c }, e: { r: 1, c } });
  }
  days.forEach((_, i) => {
    const startCol = baseHeaders.length + i * LATENESS_SUB_COLS;
    merges.push({ s: { r: 0, c: startCol }, e: { r: 0, c: startCol + LATENESS_SUB_COLS - 1 } });
  });

  const sortedData = sortTimesheetEmployees(data, sortField, sortOrder);

  const branchesMap = new Map();
  sortedData.forEach((employee) => {
    const key = employee.branchName || i18n.t("noBranch");
    if (!branchesMap.has(key)) branchesMap.set(key, []);
    branchesMap.get(key).push(employee);
  });

  const branchNames = [...branchesMap.keys()].sort((a, b) =>
    a.localeCompare(b, "ru", { sensitivity: "base" }),
  );

  const branchHeaderRows = [];

  branchNames.forEach((branchName) => {
    const rowIndex = excelData.length;
    branchHeaderRows.push(rowIndex);
    excelData.push([branchName, ...Array(colCount - 1).fill("")]);
    merges.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: colCount - 1 } });

    branchesMap.get(branchName).forEach((employee) => {
      const { sessions } = employee;

      const row = [
        employee.departmentName ?? "",
        employee.employeeFullName ?? "",
        employee.positionName ?? "",
      ];

      days.forEach((day) => {
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const session = sessions?.[dateStr];

        row.push(
          session?.firstEntry || "",
          session?.lastExit || "",
          session?.late && session.late !== "00:00" ? session.late : "",
          session?.lateLeave && session.lateLeave !== "00:00" ? session.lateLeave : "",
        );
      });

      row.push(
        i18n.t("lateDaysOutOf", {
          count: employee.totalLateCount ?? 0,
          total: employee.totalScheduledDays ?? 0,
          time: employee.totalLateTime || "00:00",
        }),
      );

      excelData.push(row);
    });
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(excelData);
  worksheet["!merges"] = merges;

  worksheet["!cols"] = [
    { wch: 22 },
    { wch: 28 },
    { wch: 22 },
    ...Array(days.length * LATENESS_SUB_COLS).fill({ wch: 9 }),
    { wch: 18 },
  ];

  applyLatenessStyles(worksheet, branchHeaderRows);

  XLSX.utils.book_append_sheet(workbook, worksheet, i18n.t("latenessTimesheet").slice(0, 31));

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(blob, `attendance_lateness_${date}.xlsx`);
};
