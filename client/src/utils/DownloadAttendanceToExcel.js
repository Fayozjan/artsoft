import * as XLSX from "xlsx-js-style";
import { saveAs } from "file-saver";

export const downloadAttendanceToExcel = (data, date) => {
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
    "Итог (часы:минуты)",
    ...Array.from({ length: daysInMonth }, (_, i) => `${i + 1}`),
  ];

  const excelData = [
    [`Посещаемость за ${monthNames[month - 1]} ${year}`],
    headers,
  ];

  const sortedData = [...data].sort((a, b) => {
    const aInfo = a.user_info;
    const bInfo = b.user_info;

    const aFullName = [aInfo.surname, aInfo.name, aInfo.patronymic]
      .filter(Boolean)
      .join(" ");
    const bFullName = [bInfo.surname, bInfo.name, bInfo.patronymic]
      .filter(Boolean)
      .join(" ");

    return (
      aInfo.branch_name.localeCompare(bInfo.branch_name, "ru", {
        sensitivity: "base",
      }) ||
      aInfo.department_name.localeCompare(bInfo.department_name, "ru", {
        sensitivity: "base",
      }) ||
      aFullName.localeCompare(bFullName, "ru", { sensitivity: "base" })
    );
  });

  sortedData.forEach((employee) => {
    const { user_info, sessions_by_date, user_id } = employee;
    const {
      name,
      surname,
      patronymic,
      branch_name,
      department_name,
      position_name,
    } = user_info;

    let totalMinutes = 0;
    let workedDays = 0;
    const dayCells = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`;
      const session = sessions_by_date[dateStr]?.[0];

      if (session) {
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

    const fullName = [surname, name, patronymic].filter(Boolean).join(" ");

    excelData.push([
      branch_name ?? "",
      department_name ?? "",
      fullName,
      user_id,
      position_name ?? "",
      workedDays,
      `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(
        2,
        "0"
      )}`,
      ...dayCells,
    ]);
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(excelData);

  worksheet["!cols"] = [
    { wch: 20 },
    { wch: 20 },
    { wch: 25 },
    { wch: 20 },
    { wch: 8 },
    { wch: 15 },
    ...Array(daysInMonth).fill({ wch: 8 }),
  ];

  const range = XLSX.utils.decode_range(worksheet["!ref"]);
  for (let row = 2; row <= range.e.r; row++) {
    for (let col = 7; col <= range.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      if (worksheet[cellAddress]?.v) {
        worksheet[cellAddress] = {
          v: worksheet[cellAddress].v,
          t: "s",
          s: { alignment: { wrapText: true, vertical: "top" } },
        };
      }
    }
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, "Посещаемость");

  // Сохраняем через file-saver
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
  saveAs(blob, "attendance.xlsx");
};
