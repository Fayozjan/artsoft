import { useState, useEffect } from "react";

import { useTranslation } from "react-i18next";

import { getLateEmployees } from "../api";

import LateTableFilter from "../components/LateTableFilter";
import Loading from "../components/Loading";
import Table from "../components/Table";
import LateCardList from "../components/LateCardList";
import LateCardListCarousel from "../components/LateCardListCarousel";
import Pagination from "../components/Pagination";
import DownloadButton from "../components/DownloadButton";

import { formatLateMinutesToHours } from "../helpers/time";
import MonthlyLateReport from "../components/MonthlyLateReport";

import styles from "./LateEmployeesPage.module.scss";
import { DownloadLate } from "../utils/downloadDoc";
import LateEmployeeModal from "../components/LateEmployeeModal";
import { useAuthStore } from "../stores/authStore";

function formatPermissionEndTime(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString.replace(" ", "T"));

  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
    include_lunch_late: false,
  });
  const [selectedMode, setSelectedMode] = useState("day");
  const { viewMode, activeBranchId } =
    useAuthStore((s) => s.userSettings) || {};

  const { t } = useTranslation();

  const hasAnyPermission = data?.lateEmployeesByMonth?.some(
    (item) => item.have_permission || item.permission_end_time,
  );

  const dayColumns = [
    { label: "№", render: (_, __, i) => i + 1 },
    {
      label: "Дата",
      accessor: "date",
      style: { minWidth: "90px" },
    },
    {
      label: "ФИО",
      accessor: "employeeFullName",
      render: (_, item) => (
        <div className={styles.employee}>
          <span>{item.employeeFullName}</span>

          {item.employeePhoto && (
            <img
              src={`/api/employees/image/${item.employeePhoto}`}
              alt="photo"
            />
          )}
        </div>
      ),
    },
    { label: "Табель №", accessor: "employeeNumber" },
    { label: "Филиал", accessor: "branchName" },
    { label: "Отдел", accessor: "departmentName" },
    { label: "Должность", accessor: "positionName" },

    {
      label: "Пришел",
      render: (_, item) => (
        <div className={styles.timeWrapper}>
          <div className={styles.timeRow}>
            <span className={styles.timeMain}>{item.actualStart || "—"}</span>
          </div>
          {item.scheduledStart && (
            <span className={styles.timeSched}>
              {item.scheduledStart.substring(0, 5)}
            </span>
          )}
        </div>
      ),
    },

    {
      label: "Опоздание",
      render: (_, item) => (
        <div className={styles.timeWrapper}>
          {item.lateMinutes > 0 && (
            <span className={styles.badgeRed}>
              +{formatLateMinutesToHours(item.lateMinutes)}
            </span>
          )}
        </div>
      ),
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

    ...(formData.include_lunch_late
      ? [
          {
            label: "Перерыв",
            render: (_, item) => {
              if (!item.scheduledBreakEnd && !item.actualBreakReturn)
                return <span>—</span>;
              return (
                <div className={styles.timeWrapper}>
                  <div className={styles.timeRow}>
                    <span className={styles.timeMain}>
                      {item.actualBreakReturn || "—"}
                    </span>
                    {item.breakReturnLateMinutes > 0 && (
                      <span className={styles.badgeRed}>
                        +{formatLateMinutesToHours(item.breakReturnLateMinutes)}
                      </span>
                    )}
                  </div>
                  {item.scheduledBreakEnd && (
                    <span className={styles.timeSched}>
                      по граф. {item.scheduledBreakEnd.substring(0, 5)}
                    </span>
                  )}
                </div>
              );
            },
          },
        ]
      : []),

    {
      label: "Сумма за опоздание",
      accessor: "monthlyLateMoney",
    },

    {
      label: "Опоздание на работу за месяц",
      accessor: "monthlyArrivalLateCount",
      render: (v, item) => {
        if (!v || v <= 0) return "—";
        const timeStr =
          item.monthlyLateMinutes > 0
            ? ` (${formatLateMinutesToHours(item.monthlyLateMinutes)})`
            : "";
        return `${v} раз ${timeStr}`;
      },
    },
    ...(formData.include_lunch_late
      ? [
          {
            label: "Опоздание после перерыва за месяц",
            accessor: "monthlyLunchLateCount",
            render: (v, item) => {
              if (!v || v <= 0) return "—";
              const timeStr =
                item.monthlyBreakReturnLateMinutes > 0
                  ? ` (${formatLateMinutesToHours(item.monthlyBreakReturnLateMinutes)})`
                  : "";
              return `${v} раз${timeStr}`;
            },
          },
        ]
      : []),
    {
      label: "Фото",
      accessor: "actualStartPhoto",
      render: (value) =>
        value ? (
          <a
            href={`/api/face-passes/image/${value}`}
            target="_blank"
            rel="noreferrer"
            className={styles.photoLink}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
            >
              <path
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 8h.01M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm0 6l4-4a3 5 0 0 1 3 0l4 4"
              />
              <path
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="m14 14l1-1a3 5 0 0 1 3 0l3 3"
              />
            </svg>
            Фото
          </a>
        ) : null,
    },
  ];

  useEffect(() => {
    const now = new Date();

    const newDate =
      formData.mode === "day"
        ? now.toISOString().slice(0, 10)
        : now.toISOString().slice(0, 7);

    // Сбрасываем данные таблицы
    setData(
      formData.mode === "day"
        ? []
        : { lateEmployeesByMonth: [], lateByBranchAndDay: [] },
    );

    // Полностью сбрасываем formData
    setFormData({
      mode: formData.mode,
      date: newDate,
      branch_id: "",
      department_id: "",
      employee_id: "",
      position_id: "",
      search: "",
      include_lunch_late: false,
    });

    // Сбрасываем viewType в дефолтное значение
    setViewType(formData.mode === "day" ? "row" : "employees");
  }, [formData.mode]);

  const fetchData = async (
    page = currentPage,
    filters = formData,
    size = pageSize,
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
    if (viewMode === "branch") {
      fetchData(1, formData, pageSize);
    }
  }, [activeBranchId]);

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
      Math.min(prevPage, Math.ceil(totalItems / size)),
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setModalData(null);
      }
    };

    if (modalData) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [modalData]);

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
              {selectedMode === "day" ? (
                data?.length > 0 && (
                  <>
                    <select
                      name="viewType"
                      id="viewType"
                      value={viewType}
                      onChange={(e) => setViewType(e.target.value)}
                    >
                      <option value="row">Список</option>
                      <option value="card">Карточки</option>
                      <option value="carousel">Мониторинг</option>
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
                )
              ) : (
                <select
                  name="viewType"
                  id="viewType"
                  value={viewType}
                  onChange={(e) => setViewType(e.target.value)}
                >
                  <option value="employees">Сотрудники</option>
                  <option value="branches">Сводка по филиалам</option>
                </select>
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

              {formData.mode === "day"
                ? data.length > 0 && (
                    <DownloadButton
                      text={t("save")}
                      onClick={() => DownloadLate.day(data, formData.date)}
                    />
                  )
                : data?.lateEmployeesByMonth?.length > 0 && (
                    <DownloadButton
                      text={t("save")}
                      onClick={() =>
                        viewType === "employees"
                          ? DownloadLate.monthByEmployee(
                              data?.lateEmployeesByMonth,
                              formData.date,
                            )
                          : DownloadLate.monthByBranch(
                              data?.lateByBranchAndDay,
                              formData.date,
                            )
                      }
                    />
                  )}
            </div>
          </div>

          {selectedMode === "day" ? (
            formData.date ? (
              viewType === "row" ? (
                <Table columns={dayColumns} data={data} />
              ) : viewType === "card" ? (
                <LateCardList
                  data={Array.isArray(data) ? data : []}
                  includeLunch={formData.include_lunch_late}
                />
              ) : (
                <LateCardListCarousel
                  data={Array.isArray(data) ? data : []}
                  includeLunch={formData.include_lunch_late}
                />
              )
            ) : (
              <></>
            )
          ) : (
            <MonthlyLateReport
              onMore={setModalData}
              data={data || []}
              viewType={viewType}
            />
          )}
        </div>
      )}

      {modalData && (
        <LateEmployeeModal
          modalData={modalData}
          onClose={() => setModalData(null)}
        />
      )}
    </div>
  );
};

export default LateEmployeesPage;
