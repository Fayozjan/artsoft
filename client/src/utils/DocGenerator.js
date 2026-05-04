import { jsPDF } from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import QRCode from "qrcode";

import { robotoRegularBase64, robotoBoldBase64 } from "./robotoFont";

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
    Email: employee.email,
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
