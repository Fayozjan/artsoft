import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";

export const downloadFullAttendanceToExcel = (data, date) => {
  if (!date || typeof date !== "string") return;
  if (!data || !data.length) return;

  const [year, month] = date.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  const monthNames = [
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
  ];

  const headers = [
    "Филиал",
    "Отдел",
    "ФИО",
    "Табельный номер",
    "Должность",
    "Дней",
    "Итог (ч:м)",
    ...Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`),
  ];

  const excelData = [headers];

  data.forEach((employee) => {
    const {
      employeeFullName,
      employeeId,
      branchName,
      departmentName,
      positionName,
      sessions,
    } = employee;

    let totalMinutes = 0;
    let workedDays = 0;
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

        const cellContent = `${allEventsTime}\r\n----------\r\nВсего: ${session.workDuration || "00:00"}`;
        dayCells.push(cellContent);

        const [h, m] = (session.workDuration || "00:00").split(":").map(Number);
        totalMinutes += h * 60 + m;
        workedDays++;
      } else {
        dayCells.push("");
      }
    }

    excelData.push([
      branchName ?? "",
      departmentName ?? "",
      employeeFullName ?? "",
      employeeId ?? "",
      positionName ?? "",
      workedDays,
      `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, "0")}`,
      ...dayCells,
    ]);
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(excelData);

  // Стили границ
  const thinBorder = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };

  const colWidths = headers.slice(0, 7).map((header, colIndex) => {
    // Находим максимальную длину строки в этой колонке
    const maxLength = excelData.reduce((max, row) => {
      const cellValue = row[colIndex] ? row[colIndex].toString() : "";
      return Math.max(max, cellValue.length);
    }, header.length);

    // Добавляем небольшой запас (2-3 символа)
    return { wch: maxLength + 2 };
  });

  // Настройка колонок
  worksheet["!cols"] = [...colWidths, ...Array(daysInMonth).fill({ wch: 14 })];

  const range = XLSX.utils.decode_range(worksheet["!ref"]);

  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      if (!worksheet[cellAddress]) continue;

      // Базовые стили для всех ячеек (границы + центрирование)
      worksheet[cellAddress].s = {
        border: thinBorder,
        alignment: {
          wrapText: true,
          vertical: "center",
          horizontal: "center",
        },
        font: { sz: 10 },
      };

      // Стили для заголовков (первая строка)
      if (R === 0) {
        worksheet[cellAddress].s.font = { bold: true, sz: 10 };
        worksheet[cellAddress].s.fill = { fgColor: { rgb: "EEEEEE" } };
      }

      // Для ячеек с датами (начиная с 7-й колонки) делаем выравнивание по верху,
      // так как там длинные списки событий
      if (C >= 7 && R > 0) {
        worksheet[cellAddress].s.alignment.vertical = "top";
      }
    }
  }

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    `${monthNames[month - 1]} ${year}`,
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

  const monthNames = [
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
  ];

  const headers = [
    "Филиал",
    "Отдел",
    "ФИО",
    "Табельный номер",
    "Должность",
    "Дней",
    "Итог (ч:м)",
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
    const {
      employeeFullName,
      employeeId,
      branchName,
      departmentName,
      positionName,
      sessions,
    } = employee;

    let totalMinutes = 0;
    let workedDays = 0;
    const dayCells = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const session = sessions?.[dateStr];

      if (session && session.firstEntry) {
        const entry = session.firstEntry || "-";
        const exit = session.lastExit || "-";
        const duration = session.workDuration || "00:00";

        dayCells.push(`${entry}\r\n${exit}\r\n${duration}`);

        const [h, m] = duration.split(":").map(Number);
        totalMinutes += h * 60 + m;
        workedDays++;
      } else {
        dayCells.push("");
      }
    }

    excelData.push([
      branchName ?? "",
      departmentName ?? "",
      employeeFullName ?? "",
      employeeId ?? "",
      positionName ?? "",
      workedDays,
      `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, "0")}`,
      ...dayCells,
    ]);
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(excelData);

  // ОПРЕДЕЛЕНИЕ СТИЛЕЙ (Копия из Full версии)
  const thinBorder = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };

  const colWidths = headers.slice(0, 7).map((header, colIndex) => {
    // Находим максимальную длину строки в этой колонке
    const maxLength = excelData.reduce((max, row) => {
      const cellValue = row[colIndex] ? row[colIndex].toString() : "";
      return Math.max(max, cellValue.length);
    }, header.length);

    // Добавляем небольшой запас (2-3 символа)
    return { wch: maxLength + 2 };
  });

  // Настройка ширины колонок (Копия из Full версии)
  worksheet["!cols"] = [...colWidths, ...Array(daysInMonth).fill({ wch: 6 })];

  const range = XLSX.utils.decode_range(worksheet["!ref"]);

  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      if (!worksheet[cellAddress]) continue;

      // Базовые стили для всех ячеек
      worksheet[cellAddress].s = {
        border: thinBorder,
        alignment: {
          wrapText: true,
          vertical: "center",
          horizontal: "center",
        },
        font: { sz: 10 },
      };

      // Стили для заголовков
      if (R === 0) {
        worksheet[cellAddress].s.font = { bold: true, sz: 10 };
        worksheet[cellAddress].s.fill = { fgColor: { rgb: "EEEEEE" } };
      }

      // Выравнивание по верху для ячеек с датами (начиная с 7-й колонки)
      if (C >= 7 && R > 0) {
        worksheet[cellAddress].s.alignment.vertical = "top";
      }
    }
  }

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    `${monthNames[month - 1]} ${year}`,
  );

  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(blob, `attendance_${date}.xlsx`);
};
