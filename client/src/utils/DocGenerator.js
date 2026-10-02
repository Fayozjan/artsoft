import { jsPDF } from "jspdf";
import "jspdf-autotable";
import XLSX from "xlsx-js-style";
import QRCode from "qrcode";
import bwipjs from "bwip-js";
import i18n from "../i18n";

import { robotoRegularBase64, robotoBoldBase64 } from "./robotoFont";
import { employeeStickerCode } from "./employeeSticker";

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

function getEmployeeStatus(status) {
  switch (status) {
    case "active":
      return "Работает";
    case "vacation":
      return "В отпуске";
    case "terminated":
      return "Уволен";
    default:
      return "Неизвестно";
  }
}

export function getAge(birthDate) {
  const today = new Date();
  const birth = new Date(birthDate);

  let age = today.getFullYear() - birth.getFullYear();

  const monthDiff = today.getMonth() - birth.getMonth();
  const dayDiff = today.getDate() - birth.getDate();

  // Если день рождения ещё не наступил в этом году — уменьшаем возраст
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age--;
  }

  return age;
}

const generateAttendanceRows = (data, daysInMonth, year, month) => {
  return data.flatMap((employee) => {
    const { user_info, sessions_by_date } = employee;
    const { name, surname, patronymic, department_name, position_name } =
      user_info;

    // Собираем данные по дням
    const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(
        day,
      ).padStart(2, "0")}`;

      if (sessions_by_date[dateStr] && sessions_by_date[dateStr].length > 0) {
        const session = sessions_by_date[dateStr][0];
        return {
          firstEntry: session.firstEntry || "—",
          lastExit: session.lastExit || "—",
          workDuration: session.workDuration || "00:00",
        };
      }
      return {
        firstEntry: "—",
        lastExit: "—",
        workDuration: "00:00",
      };
    });

    // Считаем общее время за месяц
    const totalMinutes = dailyData.reduce((total, day) => {
      if (day.workDuration !== "00:00" && day.workDuration !== "—") {
        const [hours, minutes] = day.workDuration.split(":").map(Number);
        return total + hours * 60 + minutes;
      }
      return total;
    }, 0);

    const monthlyTotal = `${String(Math.floor(totalMinutes / 60)).padStart(
      2,
      "0",
    )}:${String(totalMinutes % 60).padStart(2, "0")}`;

    // Формируем строки для каждого сотрудника
    return [
      // Основная строка с информацией о сотруднике
      [
        `${surname} ${name}${patronymic ? ` ${patronymic}` : ""}`,
        department_name,
        position_name,
        monthlyTotal,
        ...dailyData.map((day) => day.workDuration),
      ],
      // Строка с первыми входами
      ["Первые входы", "", "", "", ...dailyData.map((day) => day.firstEntry)],
      // Строка с последними выходами
      ["Последние выходы", "", "", "", ...dailyData.map((day) => day.lastExit)],
      // Пустая строка для разделения
      Array(columns.length).fill(""),
    ];
  });
};

export const downloadPdfAttendance = async (data, date) => {
  const [year, month] = date.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  // Заголовки столбцов
  const columns = [
    { title: "ФИО", dataKey: "fio" },
    { title: "Отдел", dataKey: "department" },
    { title: "Должность", dataKey: "position" },
    { title: "Итог", dataKey: "total" },
    ...Array.from({ length: daysInMonth }, (_, i) => ({
      title: `${i + 1}`,
      dataKey: `day${i + 1}`,
    })),
  ];

  // Генерируем данные для таблицы
  const rows = generateAttendanceRows(
    data.data || [],
    daysInMonth,
    year,
    month,
  );

  try {
    const doc = new jsPDF("landscape");
    doc.setFontSize(10);
    doc.text(
      `Посещаемость сотрудников за ${monthNames[month - 1]} ${year}`,
      doc.internal.pageSize.width / 2,
      10,
      { align: "center" },
    );

    // Настройки для таблицы
    const tableConfig = {
      startY: 20,
      head: [columns.map((col) => col.title)],
      body: rows,
      theme: "grid",
      headStyles: {
        fillColor: [48, 82, 216],
        fontStyle: "bold",
        textColor: [255, 255, 255],
      },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [240, 240, 240] },
      margin: { top: 20 },
      styles: {
        cellPadding: 2,
        fontSize: 8,
        valign: "middle",
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 25 },
        2: { cellWidth: 25 },
        3: { cellWidth: 15 },
        ...Object.fromEntries(
          Array.from({ length: daysInMonth }, (_, i) => [
            i + 4,
            { cellWidth: 8 },
          ]),
        ),
      },
    };

    doc.autoTable(tableConfig);
    doc.save("attendance.pdf");
  } catch (error) {
    console.error("Ошибка при скачивании PDF:", error);
  }
};

export const downloadExcelAttendance = (data, date) => {
  const [year, month] = date.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();

  // 1. Заголовки
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

  // 2. Начальные строки
  const excelData = [
    [`Посещаемость за ${monthNames[month - 1]} ${year}`],
    headers,
  ];

  // 3. Сортировка данных
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

  // 4. Обработка сотрудников
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
        day,
      ).padStart(2, "0")}`;
      const session = sessions_by_date[dateStr]?.[0];

      if (session) {
        const entry = session.firstEntry || "-";
        const exit = session.lastExit || "-";
        const duration = session.workDuration || "00:00";

        dayCells.push(`${entry}\n${exit}\n${duration}`);

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
        "0",
      )}`,
      ...dayCells,
    ]);
  });

  // 5. Книга Excel
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(excelData);

  // 6. Ширина столбцов
  worksheet["!cols"] = [
    { wch: 20 }, // Филиал
    { wch: 20 }, // Отдел
    { wch: 25 }, // ФИО
    { wch: 20 }, // Должность
    { wch: 8 }, // Дней
    { wch: 15 }, // Итог
    ...Array(daysInMonth).fill({ wch: 8 }),
  ];

  // 7. Перенос строк для ячеек с посещаемостью
  const range = XLSX.utils.decode_range(worksheet["!ref"]);
  for (let row = 2; row <= range.e.r; row++) {
    for (let col = 6; col <= range.e.c; col++) {
      // начинаем с колонки после "Итог"
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      if (worksheet[cellAddress]?.v) {
        worksheet[cellAddress].s = {
          alignment: {
            wrapText: true,
            vertical: "top",
          },
        };
      }
    }
  }

  // 8. Сохранение
  XLSX.utils.book_append_sheet(workbook, worksheet, "Посещаемость");
  XLSX.writeFile(workbook, "attendance.xlsx");
};

export const exportEmployeesToExcel = (data, fileName = "users.xlsx") => {
  // Преобразуем данные в формат, подходящий для Excel
  const excelData = data.map((employee) => ({
    Фамилия: employee.surname,
    Имя: employee.name,
    Отчество: employee.patronymic,
    "Системный номер": employee.user_id,
    "Табельный номер": employee.employee_number,
    "Дата рождения": formatDate(employee.date_of_birth),
    Возраст: getAge(employee.date_of_birth),
    Пол: employee.gender === "male" ? "Мужской" : "Женский",
    "Место рождения": employee.place_of_birth,
    Паспорт: employee.passport,
    "Дата выдачи паспорта": formatDate(employee.passport_given_date),
    "Срок действия паспорта": formatDate(employee.passport_validity_period),
    ПИНФЛ: employee.pinfl,
    Национальность: employee.nationality,
    Образование: employee.education,
    Специальность: employee.education_specialty,
    Телефон: employee.telephone,
    Адрес: employee.address,
    Отдел: employee.department_name,
    Должность: employee.position_name,
    "Дата приема": employee.hired_date,
    "Дата увольнения":
      employee.status === "terminated" ? employee.terminated_date : "",
    Статус: getEmployeeStatus(employee.status),
    "Доступные двери": employee.door?.join(", "),
    "ID рабочего графика": employee.work_schedule_id,
    "Название рабочего графика": employee.work_schedule_name,
  }));

  // Создаем новую рабочую книгу
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);

  // Добавляем лист в книгу
  XLSX.utils.book_append_sheet(wb, ws, "Сотрудники");

  // Записываем файл и запускаем скачивание
  XLSX.writeFile(wb, fileName);
};

export const downloadEmployeeImportTemplate = (employees, refs = {}, t, fileName = "employees_import_template.xlsx") => {
  const l = (key, fallback) => (t && t(key) !== key ? t(key) : fallback);

  const headers = [
    "ID",
    l("employeeNumber", "Таб. номер"),
    l("lastName", "Фамилия"),
    l("firstName", "Имя"),
    l("middleName", "Отчество"),
    l("dateOfBirth", "Дата рождения"),
    `${l("gender", "Пол")} (male=${l("male", "Мужской")}, female=${l("female", "Женский")})`,
    l("pinfl", "ПИНФЛ"),
    l("passport", "Паспорт"),
    l("passportExpiry", "Срок действия паспорта"),
    l("phone", "Телефон"),
    l("address", "Адрес"),
    `${l("branch", "Филиал")} (${l("nameDisplay", "название")})`,
    `${l("department", "Отдел")} (${l("nameDisplay", "название")})`,
    `${l("position", "Должность")} (${l("nameDisplay", "название")})`,
    `${l("status", "Статус")} (true=${l("active", "Работает")}, false=${l("terminated", "Уволен")})`,
    `${l("workSchedule", "График работы")} (${l("nameDisplay", "название")})`,
  ];

  const fmtDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      const day = String(d.getUTCDate()).padStart(2, "0");
      const month = String(d.getUTCMonth() + 1).padStart(2, "0");
      return `${day}.${month}.${d.getUTCFullYear()}`;
    } catch {
      return "";
    }
  };

  const rows = employees.map((emp) => [
    emp.id,
    emp.employee_number ?? "",
    emp.last_name ?? "",
    emp.first_name ?? "",
    emp.middle_name ?? "",
    fmtDate(emp.date_of_birth),
    emp.gender ?? "",
    emp.pinfl ?? "",
    emp.passport ?? "",
    fmtDate(emp.passport_expiry_date),
    emp.phone ?? "",
    emp.address ?? "",
    emp.branch?.name ?? "",
    emp.department?.name ?? "",
    emp.position?.name ?? "",
    emp.status === true ? "true" : emp.status === false ? "false" : "",
    emp.workSchedule?.name ?? "",
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  ws["!cols"] = [
    { wch: 6 },   // ID
    { wch: 18 },  // Табельный номер
    { wch: 20 },  // Фамилия
    { wch: 18 },  // Имя
    { wch: 18 },  // Отчество
    { wch: 14 },  // Дата рождения
    { wch: 10 },  // Пол
    { wch: 16 },  // ПИНФЛ
    { wch: 12 },  // Паспорт
    { wch: 14 },  // Срок паспорта
    { wch: 16 },  // Телефон
    { wch: 25 },  // Адрес
    { wch: 24 },  // Филиал (название)
    { wch: 24 },  // Отдел (название)
    { wch: 24 },  // Должность (название)
    { wch: 10 },  // Статус
    { wch: 24 },  // График (название)
  ];

  const border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };

  const styleSheet = (sheet, headerCount) => {
    const range = XLSX.utils.decode_range(sheet["!ref"]);
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!sheet[addr]) sheet[addr] = { v: "", t: "s" };
        const isHeader = r === 0;
        sheet[addr].s = {
          font: { bold: isHeader },
          alignment: { horizontal: "center", vertical: "center" },
          border,
        };
      }
    }
  };

  styleSheet(ws);
  XLSX.utils.book_append_sheet(wb, ws, "Сотрудники");

  XLSX.writeFile(wb, fileName);
};

export const downloadDepartmentImportTemplate = (departments, refs = {}, t, fileName = "departments_import_template.xlsx") => {
  const l = (key, fallback) => (t && t(key) !== key ? t(key) : fallback);

  const headers = [
    "ID",
    l("name", "Название"),
    l("branch", "Филиал"),
    `${l("status", "Статус")} (true=${l("active", "Активный")}, false=${l("inactive", "Неактивный")})`,
  ];

  const rows = departments.map((d) => [
    d.id,
    d.name ?? "",
    d.branch?.name ?? "",
    d.status === true ? "true" : d.status === false ? "false" : "",
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  ws["!cols"] = [
    { wch: 6 },
    { wch: 30 },
    { wch: 28 },
    { wch: 10 },
  ];

  const border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };

  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { v: "", t: "s" };
      ws[addr].s = {
        font: { bold: r === 0 },
        alignment: { horizontal: "center", vertical: "center" },
        border,
      };
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, "Отделы");

  if (refs.branches?.length) {
    const branchData = [["ID", "Название"], ...refs.branches.map((b) => [b.id, b.name])];
    const branchWs = XLSX.utils.aoa_to_sheet(branchData);
    branchWs["!cols"] = [{ wch: 8 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, branchWs, "Филиалы");
  }

  XLSX.writeFile(wb, fileName);
};

export const downloadPositionImportTemplate = (positions, t, fileName = "positions_import_template.xlsx") => {
  const l = (key, fallback) => (t && t(key) !== key ? t(key) : fallback);

  const headers = [
    "ID",
    l("name", "Название"),
    `${l("status", "Статус")} (true=${l("active", "Активный")}, false=${l("inactive", "Неактивный")})`,
  ];

  const rows = positions.map((p) => [
    p.id,
    p.name ?? "",
    p.status === true ? "true" : p.status === false ? "false" : "",
  ]);

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  ws["!cols"] = [{ wch: 6 }, { wch: 30 }, { wch: 10 }];

  const border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };

  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { v: "", t: "s" };
      ws[addr].s = {
        font: { bold: r === 0 },
        alignment: { horizontal: "center", vertical: "center" },
        border,
      };
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, "Должности");
  XLSX.writeFile(wb, fileName);
};

export const exportStaffingToExcel = (data, fileName = "staffing.xlsx") => {
  const excelData = data.map((d, i) => ({
    "№": i + 1,
    Отдел: d.name,
    Филиал: d.branch_name,
    "По штату": d.planned || 0,
    "По факту": d.actual || 0,
    "Не по штату": d.non_staffed || 0,
    Вакансии: d.vacancies || 0,
  }));
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);
  XLSX.utils.book_append_sheet(wb, ws, "Штатное расписание");
  XLSX.writeFile(wb, fileName);
};

export const downloadEmployeesAtWorkToExcel = (
  data,
  absentUsers,
  fileName = "report.xlsx",
) => {
  // Преобразуем данные в формат, подходящий для Excel
  const presentData = data.map((employee) => ({
    Фамилия: employee.user_info.surname,
    Имя: employee.user_info.name,
    Отчество: employee.user_info.patronymic,
    "Системный номер": employee.user_id,
    "Табельный номер": employee.user_info.employee_number,
    Филиал: employee.user_info.branch_name,
    Отдел: employee.user_info.department_name,
    Должность: employee.user_info.position_name,
    Дата: employee.date,
    "Первый вход": employee.firstEntry,
    "Последний выход": employee.lastExit,
  }));

  const absentData = absentUsers.map((employee) => ({
    Фамилия: employee.surname,
    Имя: employee.name,
    Отчество: employee.patronymic,
    "Системный номер": employee.user_id,
    "Табельный номер": employee.employee_number,
    Отдел: employee.department_name,
  }));

  // 3. Создаём книгу
  const wb = XLSX.utils.book_new();

  // 4. Добавляем лист "Сотрудники на месте"
  const presentSheet = XLSX.utils.json_to_sheet(presentData);
  XLSX.utils.book_append_sheet(wb, presentSheet, "Пришли");

  // 5. Добавляем лист "Отсутствующие"
  const absentSheet = XLSX.utils.json_to_sheet(absentData);
  XLSX.utils.book_append_sheet(wb, absentSheet, "Отсутствуют");

  // 6. Сохраняем
  XLSX.writeFile(wb, fileName);
};

function fmtLate(minutes) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function doorCellValue(e, t) {
  if (e.firstEntryDoor) return e.firstEntryDoor;
  if (!e.timeOffInfo) return "";
  const reason = e.timeOffInfo.reason ? ` (${e.timeOffInfo.reason})` : "";
  return `${t("excusedLeave")}${reason}`;
}

function applySheetStyles(ws) {
  if (!ws["!ref"]) return ws;
  const thin = { style: "thin", color: { rgb: "000000" } };
  const border = { top: thin, right: thin, bottom: thin, left: thin };
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const colWidths = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) continue;
      ws[addr].s = {
        border,
        alignment: { horizontal: "center", vertical: "center" },
        ...(r === 0 ? { font: { bold: true } } : {}),
      };
      const len = String(ws[addr].v ?? "").length;
      colWidths[c] = Math.max(colWidths[c] ?? 0, len);
    }
  }
  ws["!cols"] = colWidths.map((w) => ({ wch: Math.max((w ?? 0) + 2, 8) }));
  return ws;
}

function buildEmployeesByBranchSheet(branchesData, t) {
  const columns = [
    t("department"),
    t("fullName"),
    t("position"),
    t("checkedInSingular"),
    t("turnstile"),
    t("lateTimeHhMm"),
    t("checkedOutSingular"),
  ];
  const colCount = columns.length;

  const rows = [];
  const merges = [];
  const branchHeaderRows = new Set();
  const columnHeaderRows = new Set();

  const sortedBranchesData = [...branchesData].sort(
    (a, b) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
      (a.name || "").localeCompare(b.name || "", "ru", { sensitivity: "base" }),
  );

  sortedBranchesData.forEach((branch) => {
    branchHeaderRows.add(rows.length);
    merges.push({
      s: { r: rows.length, c: 0 },
      e: { r: rows.length, c: colCount - 1 },
    });
    rows.push([branch.name, ...Array(colCount - 1).fill("")]);

    columnHeaderRows.add(rows.length);
    rows.push([...columns]);

    const sortedEmployees = [...branch.employees].sort((a, b) =>
      (a.positionSortOrder ?? 0) - (b.positionSortOrder ?? 0) ||
      (a.departmentName || "").localeCompare(b.departmentName || "", "ru", { sensitivity: "base" }) ||
      (a.employeeFullName || "").localeCompare(b.employeeFullName || "", "ru", { sensitivity: "base" })
    );

    sortedEmployees.forEach((e) => {
      rows.push([
        e.departmentName || "",
        e.employeeFullName || "",
        e.positionName || "",
        e.firstEntry || "",
        doorCellValue(e, t),
        fmtLate(e.lateMinutes),
        e.lastExit || "",
      ]);
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!merges"] = merges;

  const thin = { style: "thin", color: { rgb: "000000" } };
  const border = { top: thin, right: thin, bottom: thin, left: thin };
  const colWidths = [];

  rows.forEach((row, r) => {
    row.forEach((_, c) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) return;

      if (branchHeaderRows.has(r)) {
        ws[addr].s = {
          border,
          alignment: { horizontal: "center", vertical: "center" },
          font: { bold: true, sz: 12 },
        };
      } else if (columnHeaderRows.has(r)) {
        ws[addr].s = {
          border,
          alignment: { horizontal: "center", vertical: "center" },
          font: { bold: true },
        };
      } else {
        ws[addr].s = {
          border,
          alignment: { horizontal: "center", vertical: "center" },
        };
      }

      const len = String(row[c] ?? "").length;
      colWidths[c] = Math.max(colWidths[c] ?? 0, len);
    });
  });

  ws["!cols"] = colWidths.map((w) => ({ wch: Math.max((w ?? 0) + 2, 8) }));
  return ws;
}

export const downloadAttendanceAllSheets = (branchesData, date) => {
  const t = (k) => i18n.t(k);
  const branchSheet = branchesData.map((b, i) => ({
    "№": i + 1,
    [t("branch")]: b.name,
    [t("totalLabel")]: b.totalEmployees,
    [t("checkedIn")]: b.present,
    [t("dashboard.absentToday")]: b.absent,
    [t("lateGroup")]: b.late,
    [t("onSite")]: b.inside,
    [t("checkedOut")]: b.left,
  }));

  const deptSheet = branchesData
    .flatMap((b) =>
      b.departments.map((d) => ({
        [t("branch")]: b.name,
        [t("department")]: d.name,
        [t("totalLabel")]: d.totalEmployees,
        [t("checkedIn")]: d.present,
        [t("dashboard.absentToday")]: d.absent,
        [t("lateGroup")]: d.late,
        [t("onSite")]: d.inside,
        [t("checkedOut")]: d.left,
      })),
    )
    .map((r, i) => ({ "№": i + 1, ...r }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, applySheetStyles(XLSX.utils.json_to_sheet(branchSheet)), t("byBranches"));
  XLSX.utils.book_append_sheet(wb, applySheetStyles(XLSX.utils.json_to_sheet(deptSheet)), t("byDepartments"));
  XLSX.utils.book_append_sheet(wb, buildEmployeesByBranchSheet(branchesData, t), t("byEmployees"));
  XLSX.writeFile(wb, `attendance_${date}.xlsx`);
};

// Посещаемость за период — табель: филиалы / отделы строками, дни колонками,
// в каждом дне показатели этого дня и процент посещаемости
export const downloadAttendancePeriodSheet = ({
  rows = [],
  days = [],
  metrics = [],
  period,
}) => {
  const t = (k) => i18n.t(k);

  const dayLabel = (iso) => {
    const [, m, d] = String(iso || "").split("-");
    return d ? `${d}.${m}` : String(iso || "");
  };

  const rate = (counts) =>
    counts?.scheduledEmployees > 0
      ? Math.round((counts.present / counts.scheduledEmployees) * 100) + "%"
      : "";

  // Показателей в дне + процент
  const dayWidth = metrics.length + 1;

  // Шапка в две строки: день (объединён над своими показателями) → показатели
  const headerTop = [
    t("branch") + " / " + t("department"),
    ...days.flatMap((day) => [
      dayLabel(day.date),
      ...Array(dayWidth - 1).fill(""),
    ]),
  ];

  const headerBottom = [
    "",
    ...days.flatMap(() => [...metrics.map((m) => m.short), "%"]),
  ];

  const body = rows.map((row) => [
    row.isDept ? `    ${row.name}` : row.name,
    ...days.flatMap((day) => {
      const counts = row.byDate[day.date];
      return [
        ...metrics.map((m) => (counts ? counts[m.field] || 0 : "")),
        rate(counts),
      ];
    }),
  ]);

  const ws = applySheetStyles(
    XLSX.utils.aoa_to_sheet([headerTop, headerBottom, ...body]),
  );

  // Объединяем подписи дней над их показателями
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },
    ...days.map((day, i) => ({
      s: { r: 0, c: 1 + i * dayWidth },
      e: { r: 0, c: 1 + i * dayWidth + dayWidth - 1 },
    })),
  ];

  // Колонки показателей узкие — иначе табель расползается
  ws["!cols"] = headerBottom.map((_, i) =>
    i === 0 ? { wch: 32 } : { wch: 5 },
  );

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, t("attendance"));

  const range = period ? `${period.from}_${period.to}` : "period";
  XLSX.writeFile(wb, `attendance_${range}.xlsx`);
};

export const downloadAttendanceModeSheet = (rows, mode, date) => {
  const t = (k) => i18n.t(k);
  let sheetData, sheetName;

  if (mode === "byBranch") {
    sheetData = rows.map((b, i) => ({
      "№": i + 1,
      [t("branch")]: b.name,
      [t("totalLabel")]: b.totalEmployees,
      [t("checkedIn")]: b.present,
      [t("dashboard.absentToday")]: b.absent,
      [t("lateGroup")]: b.late,
      [t("onSite")]: b.inside,
      [t("checkedOut")]: b.left,
    }));
    sheetName = t("byBranches");
  } else if (mode === "byDepartments") {
    sheetData = rows.map((d, i) => ({
      "№": i + 1,
      [t("branch")]: d.branchName || "",
      [t("department")]: d.name,
      [t("totalLabel")]: d.totalEmployees,
      [t("checkedIn")]: d.present,
      [t("dashboard.absentToday")]: d.absent,
      [t("lateGroup")]: d.late,
      [t("onSite")]: d.inside,
      [t("checkedOut")]: d.left,
    }));
    sheetName = t("byDepartments");
  } else {
    sheetName = t("byEmployees");
  }

  const wb = XLSX.utils.book_new();

  if (mode === "byEmployees") {
    const branchesMap = new Map();
    rows.forEach((e) => {
      const key = e.branchName || "";
      if (!branchesMap.has(key))
        branchesMap.set(key, { name: key, sort_order: e.branchSortOrder ?? 0, employees: [] });
      branchesMap.get(key).employees.push(e);
    });
    const branchesData = Array.from(branchesMap.values());
    XLSX.utils.book_append_sheet(wb, buildEmployeesByBranchSheet(branchesData, t), t("byEmployees"));
  } else {
    XLSX.utils.book_append_sheet(wb, applySheetStyles(XLSX.utils.json_to_sheet(sheetData)), sheetName);
  }

  XLSX.writeFile(wb, `attendance_${mode}_${date}.xlsx`);
};

// Имущество в пользовании — выгрузка списка выдач
export const exportAssetAssignmentsToExcel = (
  data,
  fileName = "asset-assignments.xlsx",
) => {
  const t = (k) => i18n.t(k);

  const stateLabel = {
    assigned: t("stateAssigned"),
    returned: t("stateReturned"),
    scrapped: t("stateScrapped"),
  };

  const excelData = data.map((item, index) => {
    const emp = item.employee || {};
    const fullName = [emp.last_name, emp.first_name, emp.middle_name]
      .filter(Boolean)
      .join(" ");
    // в скобках — id сотрудника, как в таблице на странице
    const custodian = emp.id != null ? `${fullName} (${emp.id})` : fullName;
    return {
      "№": index + 1,
      [t("custodian")]: custodian,
      [t("branch")]: emp.branch?.name || "",
      [t("department")]: emp.department?.name || "",
      [t("position")]: emp.position?.name || "",
      [t("assetName")]: item.asset_name || "",
      [t("assetSpec")]: item.asset_spec || "",
      [t("quantity")]: item.quantity ?? "",
      [t("assetCondition")]: item.asset_condition || "",
      [t("note")]: item.note || "",
      [t("assignedDate")]: formatDate(item.assigned_date),
      [t("state")]: stateLabel[item.state] || item.state || "",
      [t("returnDate")]: formatDate(item.return_date),
      [t("returnCondition")]: item.return_condition || "",
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = applySheetStyles(XLSX.utils.json_to_sheet(excelData));
  XLSX.utils.book_append_sheet(wb, ws, t("asset-assignments").slice(0, 31));
  XLSX.writeFile(wb, fileName);
};

// Шаблон импорта выдач имущества: один лист, только шапка колонок
export const downloadAssetAssignmentImportTemplate = (
  fileName = "asset-assignments-import-template.xlsx",
) => {
  const t = (k) => i18n.t(k);

  const headers = [
    `ID ${t("employee")} *`,
    `${t("assetName")} *`,
    t("assetSpec"),
    t("assetCondition"),
    t("quantity"),
    `${t("assignedDate")} * (01.01.2025)`,
    t("note"),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers]);
  // ширины под длину самих заголовков (+ запас)
  ws["!cols"] = headers.map((h, i) => ({
    wch: Math.max(String(h).length + 4, i === 4 ? 10 : 16),
  }));

  const border = {
    top: { style: "thin" },
    bottom: { style: "thin" },
    left: { style: "thin" },
    right: { style: "thin" },
  };

  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { v: "", t: "s" };
      ws[addr].s = {
        font: { bold: r === 0 },
        alignment: { horizontal: "center", vertical: "center" },
        border,
      };
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, t("assignAsset").slice(0, 31));
  XLSX.writeFile(wb, fileName);
};

export const downloadLateExcel = (data, date) => {
  const excelData = data.map((item, index) => ({
    "№": index + 1,
    Фамилия: item.surname,
    Имя: item.name,
    Отчество: item.patronymic || "",
    Отдел: item.department_name,
    Должность: item.position_name,
    "Начало работы": item.scheduled_start?.substring(0, 5) || "",
    Вход: item.actual_start || "",
    "Опоздание (мин)": item.late_minutes,
    "Опоздание (чч:мм)": formatLateMinutes(item.late_minutes),
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Опоздание");

  const filename = `Опоздание за - ${date}.xlsx`;
  XLSX.writeFile(workbook, filename);
};

// Вспомогательная функция для форматирования даты
export const formatDate = (dateString) => {
  if (!dateString) return "";

  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? "" : date.toLocaleDateString();
  } catch {
    return "";
  }
};

export const downloadPermissionPdf = async (permission) => {
  const doc = new jsPDF({ format: "a4", unit: "mm" });

  doc.addFileToVFS("Roboto-Regular.ttf", robotoRegularBase64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFileToVFS("Roboto-Bold.ttf", robotoBoldBase64);
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");

  doc.setFont("Roboto", "bold");
  doc.setFontSize(14);
  doc.text("Иш вақтида ташқарига чиқиш рухсатномаси", 105, 10, {
    align: "center",
  });

  doc.setFont("Roboto", "normal");
  doc.setFontSize(11);

  let y = 20;

  // Функция форматирования времени по Ташкенту
  const formatValue = (dateStr, type) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);

    // Опции для формата даты (ДД.ММ.ГГГГ)
    const dateOptions = {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Tashkent",
    };

    // Опции для формата времени (ЧЧ:ММ)
    const timeOptions = {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Tashkent",
    };

    const datePart = date.toLocaleDateString("ru-RU", dateOptions);

    if (type === "day_off") {
      return datePart;
    }

    const timePart = date.toLocaleTimeString("ru-RU", timeOptions);
    return `${datePart} ${timePart}`;
  };

  const botUsername = "hrsystemsartsoft_bot";
  // Рекомендую добавить ID в ссылку, чтобы QR был уникальным для каждого пропуска
  const verifyLink = `https://t.me/${botUsername}?start=${permission.id}`;
  const qrDataUrl = await QRCode.toDataURL(verifyLink, { width: 80 });
  doc.addImage(qrDataUrl, "PNG", 170, 10, 30, 30);

  const addTwoColumnsLine = (pairs) => {
    doc.setFontSize(11);
    const leftMargin = 10;
    const columnGap = 5;
    const columnWidth = 92;
    let maxLines = 1;

    pairs.forEach((pair, index) => {
      if (!pair) return;
      const x = leftMargin + index * (columnWidth + columnGap);
      const text = `${pair.label}: ${pair.value || "-"}`;
      const splitText = doc.splitTextToSize(text, columnWidth);
      doc.text(splitText, x, y);
      if (splitText.length > maxLines) {
        maxLines = splitText.length;
      }
    });
    y += maxLines * 5;
  };

  const dataPairs = [
    { label: "Номер", value: permission.id },
    {
      label: "Санадан",
      value: formatValue(permission.date_from, permission.type),
    },
    { label: "ФИО", value: permission.employeeFullName },

    {
      label: "Санагача",
      value: formatValue(permission.date_to, permission.type),
    },
    {
      label: "Филиал",
      value: permission.branch_name,
    },
    { label: "Сабаб", value: permission.reason || "" },
    {
      label: "Булим",
      value: permission.department_name,
    },
    {
      label: "Корхона хисобиданми",
      value: permission.is_company_paid ? "Ха" : "Йук",
    },
    { label: "Лавозим", value: permission.position_name },
  ];

  for (let i = 0; i < dataPairs.length; i += 2) {
    addTwoColumnsLine([dataPairs[i], dataPairs[i + 1]]);
  }

  y += 10;
  doc.text(
    `Рухсат берди: ${permission.creatorFullName || ""}  ___________________`,
    10,
    y,
  );

  doc.save(`permission-${permission.id}.pdf`);
};

// Дефолтная раскладка стикера — используется только как крайний фолбэк, если
// шаблон ещё не подгрузился с сервера (там та же раскладка живёт постоянно,
// см. work_sticker_templates.model.js#DEFAULT_ELEMENTS на бэке).
export const DEFAULT_STICKER_ELEMENTS = [
  { id: "qr", type: "qr", x: 2, y: 2, w: 20, h: 20, codeType: "qr" },
  { id: "code", type: "text", field: "code", x: 24, y: 2, w: 32, h: 6, fontSize: 11, bold: true, align: "left", valign: "top" },
  { id: "batch", type: "text", field: "batch", x: 24, y: 9, w: 32, h: 5, fontSize: 8, bold: false, align: "left", valign: "top" },
  { id: "color", type: "text", field: "color", x: 24, y: 14, w: 32, h: 5, fontSize: 8, bold: false, align: "left", valign: "top" },
  { id: "operation", type: "text", field: "operation", x: 24, y: 19, w: 32, h: 5, fontSize: 8, bold: false, align: "left", valign: "top" },
  { id: "quantity", type: "text", field: "quantity", x: 2, y: 24, w: 54, h: 6, fontSize: 9, bold: false, align: "left", valign: "top" },
  { id: "comment", type: "text", field: "comment", x: 2, y: 31, w: 54, h: 8, fontSize: 7, bold: false, align: "left", valign: "top" },
];

// Значения полей, которыми наполняются текстовые блоки макета — общие между
// PDF-генератором и live-превью в редакторе (WorkStickerTemplateEditor).
export const STICKER_FIELD_TEXT = {
  code: (s) => s.sticker_code || "ST-000000",
  batch: (s) => `Партия: ${s.batchReceiptItem?.receipt?.batch_number || "-"}`,
  color: (s) => s.batchReceiptItem?.color || "",
  color_variant: (s) => s.batchReceiptItem?.color_variant || "",
  material: (s) => s.batchReceiptItem?.material || "",
  design: (s) => s.batchReceiptItem?.design || "",
  size: (s) => s.batchReceiptItem?.size || "",
  // У брака в базе операция шага, где его забраковали (например ОТК) — на
  // напечатанной бирке это читалось бы как обычный стикер ОТК, поэтому помечаем.
  operation: (s) =>
    s.status === "scrapped"
      ? `БРАК: ${s.operationType?.name || "-"}`
      : s.operationType?.name || "-",
  // Стикер-родитель (parent) есть только у стикеров, полученных разделением
  // после приёма работы; у стикеров первой операции блок остаётся пустым.
  prev_operation: (s) => s.parent?.operationType?.name || "",
  prev_sticker_code: (s) => s.parent?.sticker_code || "",
  quantity: (s) => `Кол-во: ${s.planned_quantity ?? 0}`,
  // Дата и время создания стикера (added_at). У ещё не сохранённого стикера
  // (превью в редакторе до распределения) даты нет — показываем текущие, ведь
  // стикер будет создан именно сейчас.
  added_at: (s) => {
    const date = s.added_at ? new Date(s.added_at) : new Date();
    if (isNaN(date.getTime())) return "";
    const datePart = date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Tashkent",
    });
    const timePart = date.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Tashkent",
    });
    return `${datePart} ${timePart}`;
  },
  comment: (s) => s.comment || "",
};

export const MM_PER_PT = 0.3528;

const registerStickerFonts = (doc) => {
  doc.addFileToVFS("Roboto-Regular.ttf", robotoRegularBase64);
  doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
  doc.addFileToVFS("Roboto-Bold.ttf", robotoBoldBase64);
  doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
};

// Раскладка текстового блока — ЕДИНАЯ для PDF и превью в редакторе, чтобы
// то, что видно в редакторе, совпадало с печатью до переноса строк: шрифт
// (Roboto), размер в pt, разбивка на строки (jsPDF splitTextToSize) и позиция
// базовой линии. Координаты возвращаются в мм относительно левого-верхнего угла
// блока (x — точка выравнивания: левый край / центр / правый край).
//
// Вертикальное выравнивание — по видимым краям текста, а не по строчному
// боксу: "сверху" ставит верх заглавных букв/цифр вплотную к верхней границе
// блока, "снизу" — низ выносных элементов (у, р, д) к нижней, "по центру"
// центрует весь этот видимый блок. Поэтому текст лежит ровно в рамке блока,
// без зазора от межстрочного интервала.
const CAP_HEIGHT_EM = 0.711; // высота заглавных Roboto
const DESCENT_EM = 0.21; // глубина выносных элементов Roboto

export const layoutStickerText = (doc, text, el) => {
  const fontSize = el.fontSize || 8;
  doc.setFont("Roboto", el.bold ? "bold" : "normal");
  doc.setFontSize(fontSize);

  const align = el.align || "left";
  const x = align === "center" ? el.w / 2 : align === "right" ? el.w : 0;
  const em = fontSize * MM_PER_PT;
  const lineHeight = em * 1.15;
  const capHeight = em * CAP_HEIGHT_EM;

  const lines = doc.splitTextToSize(text, el.w);
  const inkHeight = capHeight + (lines.length - 1) * lineHeight + em * DESCENT_EM;
  const free = Math.max(el.h - inkHeight, 0);
  const valign = el.valign || "top";
  const inkTop = valign === "middle" ? free / 2 : valign === "bottom" ? free : 0;

  return {
    fontSize,
    align,
    x,
    lines: lines.map((line, i) => ({ text: line, y: inkTop + capHeight + i * lineHeight })),
  };
};

// Отдельный jsPDF только для замеров текста в редакторе (шрифты регистрируются
// один раз на всё приложение).
let previewMeasureDoc = null;
export const layoutStickerTextPreview = (text, el) => {
  if (!previewMeasureDoc) {
    previewMeasureDoc = new jsPDF({ unit: "mm" });
    registerStickerFonts(previewMeasureDoc);
  }
  return layoutStickerText(previewMeasureDoc, text, el);
};

// Тот же Roboto, что вшивается в PDF, — но для браузера (превью в редакторе).
// Без него превью рисовалось бы шрифтом интерфейса с другой шириной символов.
export const STICKER_PREVIEW_FONT = "StickerRoboto";
let previewFontsPromise = null;
export const loadStickerPreviewFonts = () => {
  if (!previewFontsPromise) {
    const faces = [
      new FontFace(STICKER_PREVIEW_FONT, `url(data:font/ttf;base64,${robotoRegularBase64})`, { weight: "400" }),
      new FontFace(STICKER_PREVIEW_FONT, `url(data:font/ttf;base64,${robotoBoldBase64})`, { weight: "700" }),
    ];
    previewFontsPromise = Promise.all(
      faces.map(async (face) => {
        await face.load();
        document.fonts.add(face);
      }),
    ).catch((err) => console.error("Ошибка загрузки шрифта превью стикера:", err));
  }
  return previewFontsPromise;
};

// QR либо Data Matrix — выбор на блоке "qr" в редакторе шаблона. Оба кодируют
// sticker_code, дальше сканируется одинаково в "Приём работы". Общая функция —
// её же использует live-превью в редакторе, чтобы картинка совпадала с PDF.
export const generateCodeDataUrl = async (text, codeType) => {
  if (codeType === "datamatrix") {
    try {
      const canvas = document.createElement("canvas");
      bwipjs.toCanvas(canvas, {
        bcid: "datamatrix",
        text,
        scale: 3,
        includetext: false,
        backgroundcolor: "FFFFFF",
      });
      return canvas.toDataURL("image/png");
    } catch (err) {
      console.error("Ошибка генерации Data Matrix:", err);
      return QRCode.toDataURL(text, { width: 120, margin: 0 });
    }
  }
  return QRCode.toDataURL(text, { width: 120, margin: 0 });
};

// Стикеры "Распределение работы": по одному на страницу, размер и раскладка
// (позиции/размер блоков в мм) — из шаблона, собранного в WYSIWYG-редакторе
// (шестерёнка в панели печати). QR/Data Matrix = sticker_code, сканируется в
// "Приём работы".
const buildWorkStickersDoc = async (stickers, template = {}) => {
  const width = Number(template.width_mm) > 0 ? Number(template.width_mm) : 58;
  const height = Number(template.height_mm) > 0 ? Number(template.height_mm) : 40;
  const elements =
    Array.isArray(template.elements) && template.elements.length > 0
      ? template.elements
      : DEFAULT_STICKER_ELEMENTS;

  // jsPDF по умолчанию считает страницу portrait и молча переставляет местами
  // ширину/высоту переданного [w,h], если w>h — явно задаём ориентацию, иначе
  // широкий стикер печатается повёрнутым на 90°.
  const orientation = width > height ? "landscape" : "portrait";
  const doc = new jsPDF({ format: [width, height], unit: "mm", orientation });

  registerStickerFonts(doc);

  for (let i = 0; i < stickers.length; i++) {
    const sticker = stickers[i];
    if (i > 0) doc.addPage([width, height], orientation);

    for (const el of elements) {
      if (el.type === "qr") {
        const codeDataUrl = await generateCodeDataUrl(sticker.sticker_code, el.codeType);
        doc.addImage(codeDataUrl, "PNG", el.x, el.y, el.w, el.h);
        continue;
      }

      // "static" — свободный текст, не привязанный к данным стикера: значение
      // лежит прямо в блоке (el.text), а не берётся через STICKER_FIELD_TEXT.
      const text = el.field === "static" ? el.text || "" : STICKER_FIELD_TEXT[el.field]?.(sticker) || "";
      if (!text) continue;

      const layout = layoutStickerText(doc, text, el);
      for (const line of layout.lines) {
        doc.text(line.text, el.x + layout.x, el.y + line.y, { align: layout.align });
      }
    }
  }

  return doc;
};

export const downloadWorkStickersPdf = async (stickers, template) => {
  if (!stickers?.length) return;
  const doc = await buildWorkStickersDoc(stickers, template);
  doc.save(`work-stickers-${stickers[0].batchReceiptItem?.receipt?.batch_number || Date.now()}.pdf`);
};

// Сразу открывает системный диалог печати (без сохранения файла на диск).
export const printWorkStickersPdf = async (stickers, template) => {
  if (!stickers?.length) return;
  const doc = await buildWorkStickersDoc(stickers, template);
  doc.autoPrint();
  window.open(doc.output("bloburl"), "_blank");
};

// Стикеры сотрудников: формат страницы — тот же, что в шаблоне стикера работы, чтобы
// печатать на тех же этикетках. Раскладка фиксированная:
// слева ФИО (фамилия крупно, имя и отчество ниже), должность и номер кода; справа QR.
// Код сканируется в "Приём работы" в режиме "Сначала сотрудник" (см. employeeSticker.js).
// Только чёрный и серый — этикетки печатают на термопринтере.
const EMPLOYEE_STICKER = {
  frame: 1, // отступ рамки от края этикетки (термопринтер обрезает кромку), мм
  pad: 3, // отступ содержимого от края, мм
  gap: 2.5, // зазор вокруг разделителя, мм
  codeShare: 0.38, // доля ширины под код
  surnameMax: 14, // шрифт фамилии: от него вниз, пока не поместится, pt
  surnameMin: 7,
  givenRatio: 0.72, // имя и отчество относительно фамилии
  givenMin: 5,
  labelH: 2.4, // высота подписи "Сотрудник"
  lineH: 2.6, // высота строки внизу (должность, номер)
  namesGap: 1, // зазор между фамилией и именем
};

// Высота "чернил" текста в мм — как считает layoutStickerText (по видимым краям).
const inkHeightMm = (lineCount, fontSize) => {
  const em = fontSize * MM_PER_PT;
  return em * CAP_HEIGHT_EM + (lineCount - 1) * em * 1.15 + em * DESCENT_EM;
};

const buildEmployeeStickersDoc = async (employees, template = {}) => {
  const width = Number(template.width_mm) > 0 ? Number(template.width_mm) : 58;
  const height = Number(template.height_mm) > 0 ? Number(template.height_mm) : 40;

  const orientation = width > height ? "landscape" : "portrait";
  const doc = new jsPDF({ format: [width, height], unit: "mm", orientation });
  registerStickerFonts(doc);

  const { frame, pad, gap, codeShare, surnameMax, surnameMin, givenRatio, givenMin, labelH, lineH, namesGap } =
    EMPLOYEE_STICKER;
  const codeSize = Math.min(height - pad * 2, width * codeShare);
  const codeX = width - pad - codeSize;
  const dividerX = codeX - gap;
  const textX = pad;
  const textW = dividerX - gap - textX;

  const setFont = (fontSize, bold) => {
    doc.setFont("Roboto", bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
  };
  const textWidth = (text, fontSize, bold) => {
    setFont(fontSize, bold);
    return doc.getTextWidth(text);
  };
  // Блок текста без выравнивания по вертикали: положение по высоте считаем сами.
  const layoutBlock = (text, fontSize, bold) =>
    layoutStickerText(doc, text, { w: textW, h: height, fontSize, bold, align: "left", valign: "top" });
  // layoutStickerText оставляет на doc шрифт последнего блока — перед рисованием ставим свой.
  const drawBlock = (layout, bold, color, y) => {
    setFont(layout.fontSize, bold);
    doc.setTextColor(color);
    for (const line of layout.lines) doc.text(line.text, textX + layout.x, y + line.y, { align: layout.align });
  };
  const fitsWidth = (layout, bold) =>
    layout.lines.every((line) => textWidth(line.text, layout.fontSize, bold) <= textW);
  // Одна строка: не помещается — обрезаем с многоточием ("..." — в шрифт точно входит).
  const oneLine = (text, fontSize, bold) => {
    let out = text;
    if (textWidth(out, fontSize, bold) <= textW) return out;
    while (out.length > 1 && textWidth(`${out}...`, fontSize, bold) > textW) out = out.slice(0, -1);
    return `${out.trimEnd()}...`;
  };

  for (let i = 0; i < employees.length; i++) {
    const employee = employees[i];
    if (i > 0) doc.addPage([width, height], orientation);

    const code = employeeStickerCode(employee.id);
    // Всегда QR, а не тип из шаблона: встроенная камера Telegram читает только QR.
    const codeDataUrl = await generateCodeDataUrl(code, "qr");

    // Рамка со скруглёнными углами и пунктирный разделитель между текстом и кодом.
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.roundedRect(frame, frame, width - frame * 2, height - frame * 2, 2, 2, "S");
    doc.setDrawColor(120);
    doc.setLineWidth(0.2);
    doc.setLineDashPattern([0.7, 0.7], 0);
    doc.line(dividerX, pad, dividerX, height - pad);
    doc.setLineDashPattern([], 0);

    doc.addImage(codeDataUrl, "PNG", codeX, (height - codeSize) / 2, codeSize, codeSize);

    // Подпись "Сотрудник" сверху.
    drawBlock(layoutBlock(String(i18n.t("employee")).toUpperCase(), 6, true), true, 90, pad);

    // Внизу — должность (серым, одной строкой) и номер кода, прижаты к нижнему краю.
    const position = String(employee.positionName || "").trim();
    let footerH = lineH;
    if (position) {
      footerH += lineH;
      drawBlock(layoutBlock(oneLine(position, 6.5, false), 6.5, false), false, 90, height - pad - footerH);
    }
    drawBlock(layoutBlock(code, 7, true), true, 0, height - pad - lineH);

    // ФИО: "Иванов Иван Иванович (12)" → фамилия крупно жирным, имя и отчество ниже.
    // Шрифт уменьшаем, пока оба блока не поместятся по высоте и ширине.
    const parts = String(employee.employeeFullName || "")
      .replace(/\s*\(\d+\)$/, "")
      .split(/\s+/)
      .filter(Boolean);
    const surname = parts[0] || "";
    const givenWords = parts.slice(1);
    const givenNames = givenWords.join(" ");
    const givenWordsFit = (fontSize) => givenWords.every((word) => textWidth(word, fontSize, false) <= textW);

    const areaTop = pad + labelH + 3;
    const areaH = height - pad - footerH - 1.5 - areaTop;

    // Подбор размера: от крупного вниз, пока фамилия и имена не поместятся по высоте и ширине.
    // Слова фамилии не рубим: jsPDF режет длинное слово посреди, поэтому строк должно быть
    // ровно столько, сколько сегментов в тексте (один, а у двойной фамилии — по дефису два).
    const fitNames = (surnameText) => {
      const segments = surnameText.split("\n").length;
      let result;
      for (let size = surnameMax; size >= surnameMin; size--) {
        // Имя и отчество — свой размер (не крупнее доли фамилии), уменьшаем по 0.5 pt, пока
        // самое длинное слово не влезет: переносится только между словами, не внутри слова.
        let givenSize = Math.max(size * givenRatio, givenMin);
        while (givenSize > givenMin && !givenWordsFit(givenSize)) givenSize = Math.max(givenSize - 0.5, givenMin);
        const surnameLayout = layoutBlock(surnameText, size, true);
        const givenLayout = givenNames ? layoutBlock(givenNames, givenSize, false) : null;
        const surnameH = inkHeightMm(surnameLayout.lines.length, size);
        const totalH = surnameH + (givenLayout ? namesGap + inkHeightMm(givenLayout.lines.length, givenSize) : 0);
        const fitted =
          totalH <= areaH &&
          surnameLayout.lines.length === segments &&
          fitsWidth(surnameLayout, true) &&
          givenWordsFit(givenSize);
        result = { surnameLayout, givenLayout, surnameH, totalH, fitted };
        if (fitted) break;
      }
      return result;
    };

    let names = fitNames(surname);
    // Двойная фамилия (Муртазаходжаев-Абдурахманов) не влезла в строку — переносим по дефису.
    if (!names.fitted && surname.includes("-")) {
      const hyphenated = fitNames(surname.replace(/-/g, "-\n"));
      if (hyphenated.fitted) names = hyphenated;
    }
    const { surnameLayout, givenLayout, surnameH, totalH } = names;
    const startY = areaTop + Math.max((areaH - totalH) / 2, 0);

    drawBlock(surnameLayout, true, 0, startY);
    if (givenLayout) drawBlock(givenLayout, false, 40, startY + surnameH + namesGap);
    doc.setTextColor(0);
  }

  return doc;
};

export const printEmployeeStickersPdf = async (employees, template) => {
  if (!employees?.length) return;
  const doc = await buildEmployeeStickersDoc(employees, template);
  doc.autoPrint();
  window.open(doc.output("bloburl"), "_blank");
};
