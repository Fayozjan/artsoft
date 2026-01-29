import React, { useState, useMemo } from "react";
import AttendanceTable from "./AttendanceTable";
import styles from "./AttendanceTable.module.scss";

export const attendanceStatsColumns = [
  { key: "name", title: "Название", sortable: true },
  { key: "total", title: "Всего", sortable: true },
  { key: "present", title: "Пришли", sortable: true },
  { key: "absent", title: "Не пришли", sortable: true },
  { key: "late", title: "Опоздали", sortable: true },
  { key: "latePercent", title: "Опоздали %", sortable: true },
  { key: "onPlace", title: "На месте", sortable: true },
  { key: "left", title: "Ушли", sortable: true },
];

const calculateStats = (employees) => {
  const total = employees.length;
  // Предполагаем наличие полей из вашего первого примера (firstEntry, lateMinutes и т.д.)
  const present = employees.filter((e) => e.firstEntry || e.actualStart).length;
  const absent = total - present;
  const late = employees.filter((e) => (e.lateMinutes || 0) > 0).length;
  const onPlace = employees.filter((e) => e.firstEntry && !e.lastExit).length; // На месте (вошел, но не вышел)
  const left = employees.filter((e) => e.lastExit).length;

  const latePercent = total > 0 ? ((late / total) * 100).toFixed(1) : 0;

  return {
    total,
    present,
    absent,
    late,
    latePercent: `${latePercent}%`,
    onPlace,
    left,
  };
};

const groupDataWithStats = (employees) => {
  const branches = {};

  employees.forEach((emp) => {
    const bName = emp.branchName || "Неизвестно";
    const dName = emp.departmentName || "Без отдела";

    if (!branches[bName]) {
      branches[bName] = { name: bName, rawEmployees: [], departments: {} };
    }
    branches[bName].rawEmployees.push(emp);

    if (!branches[bName].departments[dName]) {
      branches[bName].departments[dName] = {
        name: dName,
        branchName: bName,
        rawEmployees: [],
      };
    }
    branches[bName].departments[dName].rawEmployees.push(emp);
  });

  return Object.values(branches).map((b) => ({
    name: b.name,
    ...calculateStats(b.rawEmployees),
    employees: b.rawEmployees,
    departments: Object.values(b.departments).map((d) => ({
      name: d.name,
      branchName: d.branchName,
      ...calculateStats(d.rawEmployees),
      employees: d.rawEmployees,
    })),
  }));
};

const BranchAttendance = ({ data = [] }) => {
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [modal, setModal] = useState({ isOpen: false, data: [], title: "" });

  // Группируем и считаем статистику
  const reportData = useMemo(() => groupDataWithStats(data), [data]);

  const handleBranchClick = (branch) => {
    setSelectedBranch(selectedBranch?.name === branch.name ? null : branch);
  };

  const openEmployeeModal = (e, items, title) => {
    e.stopPropagation();
    setModal({ isOpen: true, data: items, title });
  };

  return (
    <div className={styles.wrapper}>
      {/* ТАБЛИЦА ФИЛИАЛОВ */}
      <section className={styles.tableSection}>
        <h3>Посещаемость по филиалам</h3>
        <table className={styles.table}>
          <thead>
            <tr>
              {attendanceStatsColumns.map((col) => (
                <th key={col.key}>{col.title}</th>
              ))}
              <th>Список</th>
            </tr>
          </thead>
          <tbody>
            {reportData.map((branch) => (
              <tr
                key={branch.name}
                onClick={() => handleBranchClick(branch)}
                className={
                  selectedBranch?.name === branch.name ? styles.selected : ""
                }
              >
                {attendanceStatsColumns.map((col) => (
                  <td key={col.key}>{branch[col.key]}</td>
                ))}
                <td>
                  <button
                    onClick={(e) =>
                      openEmployeeModal(
                        e,
                        branch.employees,
                        `Филиал: ${branch.name}`
                      )
                    }
                  >
                    👤
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ТАБЛИЦА ОТДЕЛОВ */}
      {selectedBranch && (
        <section className={styles.tableSection}>
          <hr />
          <h3>Отделы филиала: {selectedBranch.name}</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                {attendanceStatsColumns.map((col) => (
                  <th key={col.key}>{col.title}</th>
                ))}
                <th>Список</th>
              </tr>
            </thead>
            <tbody>
              {selectedBranch.departments.map((dept) => (
                <tr key={dept.name}>
                  {attendanceStatsColumns.map((col) => (
                    <td key={col.key}>{dept[col.key]}</td>
                  ))}
                  <td>
                    <button
                      onClick={(e) =>
                        openEmployeeModal(
                          e,
                          dept.employees,
                          `Отдел: ${dept.name}`
                        )
                      }
                    >
                      👤
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* МОДАЛКА С ПОДРОБНЫМ СПИСКОМ СОТРУДНИКОВ */}
      {modal.isOpen && (
        <div
          className={styles.modal}
          onClick={() => setModal({ ...modal, isOpen: false })}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Вызываем ваш основной AttendanceTable, который уже умеет показывать фото, время входа и т.д. */}
            <AttendanceTable
              data={{ employees: modal.data }}
              modalType="employees"
              modalTitle={modal.title}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default BranchAttendance;
