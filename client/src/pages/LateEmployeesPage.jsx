import { useState, useEffect } from "react";

import { useTranslation } from "react-i18next";

import { getLateEmployees } from "../api";

import LateTableFilter from "../components/LateTableFilter";
import Loading from "../components/Loading";
import LateCardList from "../components/LateCardList";
import LateCardListCarousel from "../components/LateCardListCarousel";
import Pagination from "../components/Pagination";
import DownloadButton from "../components/DownloadButton";

import { formatLateMinutesToHours } from "../helpers/time";
import MonthlyLateReport from "../components/MonthlyLateReport";

import styles from "./LateEmployeesPage.module.scss";
import { DownloadLate } from "../utils/downloadDoc";
import { Clock, AlarmClock, Users, Coffee, Wallet } from "lucide-react";
import SalarySort from "../components/SalarySort";

const LATE_SORT_FIELDS = [
  { value: "last_name", labelKey: "fullName" },
  { value: "employee_number", labelKey: "employeeNumber" },
  { value: "late_minutes", labelKey: "lateCol" },
  { value: "monthly_arrival_late_count", labelKey: "lateCount" },
  { value: "monthly_late_minutes", labelKey: "lateTime" },
  { value: "monthly_late_money", labelKey: "lateMoney" },
  { value: "branch", labelKey: "branch" },
  { value: "department", labelKey: "department" },
  { value: "position", labelKey: "position" },
];

const fmt = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const StatWidget = ({ icon: Icon, color, label, value, sub, progress }) => (
  <div className={styles.statWidget}>
    <div className={styles.statWidgetInner}>
      <div
        className={styles.statWidgetIcon}
        style={{ background: color + "18" }}
      >
        <Icon size={15} color={color} strokeWidth={2} />
      </div>
      <div className={styles.statWidgetContent}>
        <span className={styles.statWidgetLabel}>{label}</span>
        <span className={styles.statWidgetValue} style={{ color }}>
          {value}
          {sub && <span className={styles.statWidgetSub}> {sub}</span>}
        </span>
      </div>
    </div>
    {progress != null && (
      <div className={styles.statWidgetProgressTrack}>
        <div
          className={styles.statWidgetProgressFill}
          style={{
            width: `${Math.min(100, Math.max(0, progress))}%`,
            background: color,
          }}
        />
      </div>
    )}
  </div>
);
import LateEmployeeModal from "../components/LateEmployeeModal";
import { useAuthStore } from "../stores/authStore";
import { Icons } from "../icons/icons";
import LateEmployeesTable from "../components/LateEmployeesTable";

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
    sort_by: "last_name",
    sort_order: "asc",
  });
  const [selectedMode, setSelectedMode] = useState("day");
  const { viewMode, activeBranchId } =
    useAuthStore((s) => s.userSettings) || {};

  const { t } = useTranslation();

  const hasAnyPermission = data?.lateEmployeesByMonth?.some(
    (item) => item.have_permission || item.permission_end_time,
  );

  const dayColumns = [
    { label: "№", group: "day", render: (_, __, i) => i + 1 },
    // {
    //   label: "Дата",
    //   accessor: "date",
    //   group: "day",
    //   style: { minWidth: "90px" },
    // },
    {
      label: t("fullName"),
      accessor: "employeeFullName",
      group: "day",
      render: (_, item) => (
        <div className={styles.empCell}>
          {item.employeePhoto && (
            <img
              src={`/api/employees/image/${item.employeePhoto}`}
              alt="photo"
            />
          )}
          <div className={styles.empInfo}>
            <span className={styles.empName}>{item.employeeFullName}</span>
            <span className={styles.empSub}>
              {[item.branchName, item.departmentName]
                .filter(Boolean)
                .join(" / ")}
            </span>
          </div>
        </div>
      ),
    },
    { label: t("employeeNumber"), accessor: "employeeNumber", group: "day" },
    { label: t("position"), accessor: "positionName", group: "day" },

    {
      label: t("checkedInSingular"),
      group: "day",
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
      label: t("lateCol"),
      group: "day",
      render: (_, item) => (
        <div className={styles.timeWrapper}>
          {item.lateMinutes > 0 && (
            <span className={styles.badgeRed}>
              {formatLateMinutesToHours(item.lateMinutes)}
            </span>
          )}
        </div>
      ),
    },

    {
      label: t("penaltyAmount"),
      accessor: "dailyLateMoney",
      group: "day",
      render: (v) => (v ? fmt(v) : "—"),
    },

    ...(hasAnyPermission
      ? [
          {
            label: t("dayOff"),
            accessor: "havePermission",
            group: "day",
            render: (value) => (value ? t("yes") : t("no")),
          },
          {
            label: t("permissionEnd"),
            accessor: "permissionEndTime",
            group: "day",
            render: formatPermissionEndTime,
          },
        ]
      : []),

    ...(formData.include_lunch_late
      ? [
          {
            label: t("breakLabel"),
            group: "day",
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
                      {t("schedLabel")} {item.scheduledBreakEnd.substring(0, 5)}
                    </span>
                  )}
                </div>
              );
            },
          },
        ]
      : []),

    {
      label: t("lateCol"),
      accessor: "monthlyArrivalLateCount",
      group: "month",
      render: (v, item) => {
        if (!v || v <= 0) return "—";
        const timeStr =
          item.monthlyLateMinutes > 0
            ? ` (${formatLateMinutesToHours(item.monthlyLateMinutes)} ${t("hoursShort")})`
            : "";
        return `${v} ${timeStr}`;
      },
    },
    ...(formData.include_lunch_late
      ? [
          {
            label: t("lateAfterBreak"),
            accessor: "monthlyLunchLateCount",
            group: "month",
            render: (v, item) => {
              if (!v || v <= 0) return "—";
              const timeStr =
                item.monthlyBreakReturnLateMinutes > 0
                  ? ` (${formatLateMinutesToHours(item.monthlyBreakReturnLateMinutes)} ${t("hoursShort")})`
                  : "";
              return `${v} ${timeStr}`;
            },
          },
        ]
      : []),
    {
      label: t("penaltyAmount"),
      accessor: "monthlyLateMoney",
      group: "month",
      render: (v) => (v ? fmt(v) : "—"),
    },
    // {
    //   label: "Фото",
    //   accessor: "actualStartPhoto",
    //   render: (value) =>
    //     value ? (
    //       <a
    //         href={`/api/face-passes/image/${value}`}
    //         target="_blank"
    //         rel="noreferrer"
    //         className={styles.photoLink}
    //       >
    //         <svg
    //           xmlns="http://www.w3.org/2000/svg"
    //           width="16"
    //           height="16"
    //           viewBox="0 0 24 24"
    //         >
    //           <path
    //             fill="none"
    //             stroke="currentColor"
    //             strokeLinecap="round"
    //             strokeLinejoin="round"
    //             strokeWidth="2"
    //             d="M15 8h.01M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3zm0 6l4-4a3 5 0 0 1 3 0l4 4"
    //           />
    //           <path
    //             fill="none"
    //             stroke="currentColor"
    //             strokeLinecap="round"
    //             strokeLinejoin="round"
    //             strokeWidth="2"
    //             d="m14 14l1-1a3 5 0 0 1 3 0l3 3"
    //           />
    //         </svg>
    //         Фото
    //       </a>
    //     ) : null,
    // },
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
      sort_by: "last_name",
      sort_order: "asc",
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

  const handleSortApply = (sort_by, sort_order) => {
    const updated = { ...formData, sort_by, sort_order };
    setFormData(updated);
    fetchData(1, updated, pageSize);
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

  const lateItems = Array.isArray(data)
    ? data
    : data?.lateEmployeesByMonth || [];
  const totalLateMinutes = lateItems.reduce(
    (a, b) => a + (b.lateMinutes || b.monthlyLateMinutes || 0),
    0,
  );
  const totalArrivalLateCount = lateItems.reduce(
    (a, b) => a + (b.monthlyArrivalLateCount || 0),
    0,
  );
  const totalBreakReturnCount = lateItems.reduce(
    (a, b) => a + (b.monthlyLunchLateCount || 0),
    0,
  );
  const totalBreakReturnMinutes = lateItems.reduce(
    (a, b) => a + (b.monthlyBreakReturnLateMinutes || 0),
    0,
  );
  const totalLateMoney = lateItems.reduce(
    (a, b) => a + (Number(b.monthlyLateMoney) || 0),
    0,
  );

  return (
    <div className={styles.lateEmployeesPage}>
      {loading ? (
        <Loading />
      ) : (
        <div className={styles.main}>
          {(totalItems > 0 || lateItems.length > 0) && (
            <div className={styles.statsGrid}>
              <StatWidget
                icon={Users}
                color="#ef4444"
                label={t("lateEmployeesLabel")}
                value={totalItems || lateItems.length}
              />
              <StatWidget
                icon={Clock}
                color="#f59e0b"
                label={t("lateTime")}
                value={formatLateMinutesToHours(totalLateMinutes)}
                sub={t("hoursShort")}
              />
              <StatWidget
                icon={AlarmClock}
                color="#6366f1"
                label={t("average")}
                value={formatLateMinutesToHours(
                  lateItems.length > 0
                    ? Math.round(totalLateMinutes / lateItems.length)
                    : 0,
                )}
                sub={t("hoursShort")}
              />
              {selectedMode === "month" && totalArrivalLateCount > 0 && (
                <StatWidget
                  icon={Clock}
                  color="#dc2626"
                  label={t("lateOccurrences")}
                  value={totalArrivalLateCount}
                />
              )}
              {selectedMode === "month" && totalBreakReturnCount > 0 && (
                <StatWidget
                  icon={Coffee}
                  color="#f97316"
                  label={t("afterBreak")}
                  value={totalBreakReturnCount}
                  sub={
                    totalBreakReturnMinutes > 0
                      ? `${formatLateMinutesToHours(totalBreakReturnMinutes)} ${t("hoursShort")}`
                      : undefined
                  }
                />
              )}
              {selectedMode === "month" && totalLateMoney > 0 && (
                <StatWidget
                  icon={Wallet}
                  color="#6366f1"
                  label={t("latePenaltyAmount")}
                  value={fmt(totalLateMoney)}
                />
              )}
            </div>
          )}
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

              <SalarySort
                sort_by={formData.sort_by}
                sort_order={formData.sort_order}
                onApply={handleSortApply}
                fields={LATE_SORT_FIELDS}
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
                      <option value="row">{t("listView")}</option>
                      <option value="card">{t("cardView")}</option>
                      <option value="carousel">{t("monitoring")}</option>
                    </select>

                    <label className={styles.autoRefresh}>
                      <span className={styles.label}>{t("autoUpdate")}</span>
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
                  <option value="employees">{t("employees")}</option>
                  <option value="branches">{t("branchSummary")}</option>
                </select>
              )}

              <div className={styles.refreshBtn} onClick={() => fetchData()}>
                {Icons.refresh}
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
                <LateEmployeesTable
                  columns={dayColumns}
                  data={data}
                  date={formData.date}
                />
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
