import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import { useTranslation } from "react-i18next";

import { getLateEmployees } from "../api";

import LateTableFilter from "../components/LateTableFilter";
import Loading from "../components/Loading";
import Table from "../components/Table";
import LateCardList from "../components/LateCardList";
import LateCardListCarousel from "../components/LateCardListCarousel";
import Pagination from "../components/Pagination";
import DownloadButton from "../components/DownloadButton";

import styles from "./LateEmployeesPage.module.scss";
import { formatLateMinutesToHours } from "../helpers/time";

function formatPermissionEndTime(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString.replace(" ", "T"));

  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const downloadLateExcel = (data, date) => {
  const excelData = data.map((item, index) => ({
    "№": index + 1,
    ФИО: `${item.surname} ${item.name} ${item.patronymic} ${item.user_id}`,
    Филиал: item.branch_name,
    Отдел: item.department_name,
    Должность: item.position_name,
    "По граффику": item.scheduled_start?.substring(0, 5) || "",
    Вход: item.actual_start || "",
    "Опоздание (чч:мм)": formatLateMinutesToHours(item.late_minutes),
  }));

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Опоздание");

  const filename = `Опоздание за - ${date}.xlsx`;
  XLSX.writeFile(workbook, filename);
};

const downloadLateMonthExcel = (data, date = "") => {
  // Собираем все уникальные даты опозданий
  const allDatesSet = new Set();
  data.forEach((item) => {
    item.lateDays.forEach((d) => {
      allDatesSet.add(d.date);
    });
  });

  const allDates = Array.from(allDatesSet).sort(); // сортируем по дате

  // Сортируем по ФИО (по алфавиту, регистр не учитываем)
  const sortedData = [...data].sort((a, b) =>
    a.fullname.localeCompare(b.fullname, "ru", { sensitivity: "base" })
  );

  // Формируем данные для Excel
  const excelData = sortedData.map((item, index) => {
    const row = {
      "№": index + 1,
      ФИО: item.fullname,
      Филиал: item.branch_name,
      Отдел: item.department_name,
      Должность: item.position_name,
      "Опозданий за месяц": item.monthly_late_count,
    };

    // Добавляем колонки с датами
    allDates.forEach((date) => {
      const lateEntry = item.lateDays.find((d) => d.date === date);
      if (lateEntry) {
        const { scheduled, actual, minutesLate } = lateEntry;
        const hours = Math.floor(minutesLate / 60);
        const minutes = minutesLate % 60;
        const formattedLate =
          hours > 0 ? `${hours} ч. ${minutes} мин.` : `${minutes} мин.`;

        row[date] = `${scheduled.slice(
          0,
          5
        )} - ${actual} (Опоздание: ${formattedLate})`;
      } else {
        row[date] = "";
      }
    });

    return row;
  });

  // Генерация Excel
  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Опоздание");

  const filename = `Опоздание за - ${date}.xlsx`;
  XLSX.writeFile(workbook, filename);
};

const LateEmployeesPage = () => {
  const [data, setData] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(1);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [viewType, setViewType] = useState("row");
  const [modalData, setModalData] = useState(null);
  const [formData, setFormData] = useState({
    mode: "day",
    date: new Date().toISOString().slice(0, 10),
    branch_id: "",
    department_id: "",
    employee_id: "",
    position_id: "",
  });
  const [selectedMode, setSelectedMode] = useState("day");

  const { t } = useTranslation();

  const hasAnyPermission = data.some(
    (item) => item.have_permission || item.permission_end_time
  );

  const dayColumns = [
    { label: "№", render: (_, __, i) => i + 1 },
    {
      label: "ФИО",
      accessor: "employeeFullName",
      render: (_, item) => (
        <div className={styles.employee}>
          <span>{item.employeeFullName}</span>

          {item.employeePhoto && <img src={item.employeePhoto} alt="photo" />}
        </div>
      ),
    },
    { label: "Табель №", accessor: "employeeNumber" },
    { label: "Филиал", accessor: "branchName" },
    { label: "Отдел", accessor: "departmentName" },
    { label: "Должность", accessor: "positionName" },

    {
      label: "По графику",
      accessor: "scheduledStart",
      render: (value) => value?.substring(0, 5),
    },

    ,
    { label: "Вход", accessor: "actualStart" },
    {
      label: "Фото входа",
      accessor: "actualStartPhoto",
      render: (value) =>
        value ? <img src={value} alt="photo" /> : <div></div>,
    },
    ...(hasAnyPermission
      ? [
          {
            label: "Отгул",
            accessor: "havePermission",
            render: (value) => (value ? "Да" : "Нет"),
          },
          {
            label: "Конец отгула",
            accessor: "permissionEndTime",
            render: formatPermissionEndTime,
          },
        ]
      : []),
    ,
    {
      label: "Опоздание (чч:мм)",
      accessor: "lateMinutes",
      render: formatLateMinutesToHours,
    },
    {
      label: "Опоздание в деньгах",
      accessor: "monthlyLateMoney",
    },
    {
      label: "Кол-во опозданий за месяц",
      accessor: "monthlyLateCount",
    },
  ];

  const monthColumns = [
    { label: "№", render: (_, __, i) => i + 1 },
    {
      label: "ФИО",
      accessor: "fullName",
      render: (_, item) => (
        <div className={styles.employee}>
          <span>{item.employeeFullName}</span>

          {item.employeePhoto && <img src={item.employeePhoto} alt="photo" />}
        </div>
      ),
    },
    { label: "Филиал", accessor: "branchName" },
    { label: "Отдел", accessor: "departmentName" },
    { label: "Должность", accessor: "positionName" },
    {
      label: "Кол-во опозданий за месяц",
      accessor: "monthlyLateCount",
    },
    {
      label: "Суммарное опоздание (чч:мм)",
      accessor: "monthlyLateMinutes",
      render: (_, item) => {
        return formatLateMinutesToHours(item.monthlyLateMinutes);
      },
    },
    {
      label: "Суммарное опоздание в деньгах",
      accessor: "monthlyLateMoney",
    },
    {
      label: "Действие",
      render: (_, item) => (
        <button className={styles.btnMore} onClick={() => setModalData(item)}>
          Подробно
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
          >
            <path
              fill="none"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="m10 17l5-5m0 0l-5-5"
            />
          </svg>
        </button>
      ),
    },
  ];

  useEffect(() => {
    const now = new Date();
    if (formData.mode === "day") {
      const today = now.toISOString().slice(0, 10);
      setFormData((prev) => ({ ...prev, date: today }));
    } else if (formData.mode === "month") {
      const currentMonth = now.toISOString().slice(0, 7);
      setFormData((prev) => ({ ...prev, date: currentMonth }));
    }
  }, [formData.mode]);

  const fetchData = async (
    page = currentPage,
    filters = formData,
    size = pageSize
  ) => {
    setLoading(true);
    try {
      const { data, pagination } = await getLateEmployees({
        page,
        pageSize: size,
        filters,
      });

      setData(data);
      setTotalPages(pagination?.totalPages);
      setCurrentPage(pagination?.currentPage ?? currentPage);
      setTotalItems(pagination?.totalItems);
    } catch (err) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentPage);
  }, [currentPage, pageSize]);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleChangePageSize = (e) => {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    setCurrentPage((prevPage) =>
      Math.min(prevPage, Math.ceil(totalItems / size))
    );
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSelectedMode(formData.mode);
    await fetchData(1, formData);
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchData(1, formData, pageSize);
  };

  // Логика автообновлении
  useEffect(() => {
    if (!autoRefresh || !formData.date) return;
    const FIVE_MIN = 5 * 60 * 1000;

    const interval = setInterval(() => {
      const today = new Date().toISOString().split("T")[0];

      // если пользователь следил за сегодняшней датой — обновим дату после наступления нового дня
      if (formData?.date !== today) {
        setFormData((prev) => ({ ...prev, date: today }));
      }
    }, FIVE_MIN);

    return () => clearInterval(interval);
  }, [autoRefresh, formData.date]);

  return (
    <div className={styles.lateEmployeesPage}>
      {loading ? (
        <Loading />
      ) : (
        <div className={styles.main}>
          <div className={styles.mainHeader}>
            <div className={styles.filterWrapper}>
              <div className={styles.searchInput}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="19"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="#000000"
                    d="M15.096 5.904a6.5 6.5 0 1 0-9.192 9.192a6.5 6.5 0 0 0 9.192-9.192ZM4.49 4.49a8.5 8.5 0 0 1 12.686 11.272l5.345 5.345l-1.414 1.414l-5.345-5.345A8.501 8.501 0 0 1 4.49 4.49Z"
                  />
                </svg>

                <input
                  type="text"
                  placeholder={t("search")}
                  value={formData.search || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      search: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleSearch();
                    }
                  }}
                />

                {formData.search && (
                  <svg
                    className={styles.clearBtn}
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        search: "",
                      }));
                    }}
                    xmlns="http://www.w3.org/2000/svg"
                    width="19"
                    height="18"
                    viewBox="0 0 24 24"
                  >
                    <path
                      fill="none"
                      stroke="#000000"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                )}
              </div>

              <LateTableFilter
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleFormSubmit}
                t={t}
              />
            </div>

            <Pagination
              currentPage={currentPage}
              pageSize={pageSize}
              totalItems={totalItems}
              totalPages={totalPages}
              handleChangePageSize={handleChangePageSize}
              handlePageChange={handlePageChange}
            />

            <div className={styles.buttonsWrapper}>
              {selectedMode !== "month" && data.length > 0 && (
                <>
                  <select
                    name="viewType"
                    id="viewType"
                    value={viewType}
                    onChange={(e) => setViewType(e.target.value)}
                  >
                    <option value="row">Список</option>
                    <option value="card">Карточки</option>
                    <option value="carousel">Карусель</option>
                  </select>

                  <label className={styles.autoRefresh}>
                    <span className={styles.label}>Автообновление</span>
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      className={styles.toggle}
                    />
                  </label>
                </>
              )}

              <div className={styles.refreshBtn} onClick={() => fetchData()}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="200"
                  height="200"
                  viewBox="0 0 24 24"
                >
                  <path
                    fill="none"
                    stroke="#000000"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4m-4 4a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"
                  />
                </svg>

                <span>Обновить данные</span>
              </div>

              {data.length > 0 && (
                <DownloadButton
                  text={t("save")}
                  onClick={
                    formData.mode === "month"
                      ? () => downloadLateMonthExcel(data, formData.date)
                      : () => downloadLateExcel(data, formData.date)
                  }
                />
              )}
            </div>
          </div>

          {selectedMode === "day" ? (
            viewType === "row" ? (
              <Table
                columns={dayColumns}
                data={data.sort((b, a) => a.late_minutes - b.late_minutes)}
              />
            ) : viewType === "card" ? (
              <LateCardList
                data={data.sort((b, a) => a.late_minutes - b.late_minutes)}
              />
            ) : (
              <LateCardListCarousel
                data={data.sort((b, a) => a.late_minutes - b.late_minutes)}
              />
            )
          ) : (
            <Table
              columns={monthColumns}
              setModalData={setModalData}
              data={data.sort((b, a) => a.late_minutes - b.late_minutes)}
            />
          )}
          {modalData && (
            <div
              className={styles.modalOverlay}
              onClick={() => setModalData(null)}
            >
              <div
                className={styles.modalContent}
                onClick={(e) => e.stopPropagation()}
              >
                <h3>{"Опоздание за месяц по дням"}</h3>

                <p>{modalData.fullName}</p>

                <table className={styles.lateTable}>
                  <thead>
                    <tr>
                      <th>№</th>
                      <th>Дата</th>
                      <th>По графику</th>
                      <th>Пришел</th>
                      <th>Опоздание (чч:мм)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalData.details?.map((item, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{item.date}</td>
                        <td>{item.scheduledStart}</td>
                        <td>{item.actualStart}</td>
                        <td>{formatLateMinutesToHours(item.lateMinutes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LateEmployeesPage;
