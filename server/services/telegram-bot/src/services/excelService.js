import ExcelJS from "exceljs";
import path from "node:path";
import fs from "node:fs/promises";

export async function generateAttendanceExcel(date, groupedData) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Attendance");

  sheet.columns = [
    { header: "Отдел", key: "department", width: 25 },
    { header: "Имя", key: "name", width: 25 },
    { header: "Должность", key: "position", width: 25 },
    { header: "Вход", key: "entry", width: 15 },
    { header: "Выход", key: "exit", width: 15 },
    { header: "Отработано", key: "worked", width: 15 },
  ];

  for (const [department, employees] of Object.entries(groupedData)) {
    employees.forEach((emp) => {
      sheet.addRow({
        department,
        name: emp.name,
        position: emp.position,
        entry: emp.entry || "нет входа",
        exit: emp.exit || "нет выхода",
        worked: emp.workDuration ?? "00:00",
      });
    });
  }

  const dir = path.resolve(process.cwd(), "uploads");
  // Создаем папку, если её нет
  await fs.mkdir(dir, { recursive: true });

  const filePath = path.join(dir, `attendance_${date}.xlsx`);
  await workbook.xlsx.writeFile(filePath);

  return filePath;
}
