import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Users, PartyPopper, UserCheck, UserX, Calculator, Clock } from "lucide-react";

import { useAuthStore } from "../stores/authStore";
import { useAlertStore } from "../stores/alertStore";
import { getTimesheet, recalculateTimesheet } from "../api";
import {
  downloadAttendanceToExcel,
  downloadFullAttendanceToExcel,
  downloadLatenessAttendanceToExcel,
} from "../utils/DownloadAttendanceToExcel";

import Loading from "../components/Loading";
import { Timesheet } from "../features/timesheet";
import Pagination from "../components/Pagination";
import TimesheetFilter from "../components/TimesheetFilter";
import TimesheetSort, { DEFAULT_SORT_BY } from "../components/TimesheetSort";
import TimesheetColumnToggle from "../components/TimesheetColumnToggle";
import DownloadButton from "../components/DownloadButton";

import Search from "../components/Search";
import styles from "./TimesheetPage.module.scss";
import { Icons } from "../icons/icons";
import { getCurrentIsoWeek, getIsoWeekDaysInMonth } from "../utils/date";
import { useWidgetsStore } from "../stores/widgetsStore";

const DEFAULT_COLUMNS = {
  position: true,
  pinfl: true,
  workSchedule: true,
  lateHours: true,
  overtimeHours: true,
  paidTimeOff: true,
};

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

function getCurrentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  const monthStr = `${year}-${month}`;

  return monthStr;
}

const TimesheetPage = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(1);
  const { t } = useTranslation();
  const { widgetsVisible } = useWidgetsStore();
  const [widgetsScrollHidden, setWidgetsScrollHidden] = useState(false);
  const lastScrollTopRef = useRef(0);

  const handleTableScroll = (e) => {
    const el = e.currentTarget;
    const scrollTop = el.scrollTop;
    const lastScrollTop = lastScrollTopRef.current;
    lastScrollTopRef.current = scrollTop;

    // мало данных — почти нечего скроллить, скрытие виджета меняет
    // высоту tableContainer и вызывает бесконечный hide/show (мигание)
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll < 40) {
      setWidgetsScrollHidden(false);
      return;
    }

    const delta = scrollTop - lastScrollTop;
    if (scrollTop <= 0) {
      setWidgetsScrollHidden(false);
    } else if (delta > 8) {
      setWidgetsScrollHidden(true);
    }
  };
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const downloadMenuRef = useRef(null);

  const [formData, setFormData] = useState({
    viewMode: "month",
    month: getCurrentMonth(),
    week: getCurrentIsoWeek(),
    branch_ids: [],
    department_ids: [],
    position_ids: [],
    employee_ids: [],
    status: "true",
    hasEvents: "yes",
  });


  const [sortField, setSortField] = useState(DEFAULT_SORT_BY);
  const [sortOrder, setSortOrder] = useState("asc");

  const { showAlert } = useAlertStore();
  const [recalculating, setRecalculating] = useState(false);
  const isPastMonth = formData.month < getCurrentMonth();
  const weekDays =
    formData.viewMode === "week" && formData.week
      ? getIsoWeekDaysInMonth(formData.week, formData.month)
      : null;
  const weekDaySet = useMemo(
    () => (weekDays?.length ? new Set(weekDays) : null),
    [weekDays],
  );

  const settings = useAuthStore((s) => s.userSettings.settings);
  const updateSettings = useAuthStore((s) => s.updateSettings);
  const visibleColumns = useMemo(
    () => ({ ...DEFAULT_COLUMNS, ...settings?.timesheet?.columns }),
    [settings],
  );

  const handleSort = (field, order) => {
    setSortField(field);
    setSortOrder(order);
  };

  const buildRequestFilters = (filters) =>
    filters.viewMode === "week" && filters.week
      ? {
          ...filters,
          weekDays: getIsoWeekDaysInMonth(filters.week, filters.month),
        }
      : filters;

  const fetchData = async (
    page = currentPage,
    filters = formData,
    size = pageSize,
  ) => {
    setLoading(true);
    try {
      const requestFilters = buildRequestFilters(filters);

      const { data, pagination, calendar } = await getTimesheet({
        page,
        pageSize: size,
        filters: requestFilters,
      });

      setData(data);
      setTotalPages(pagination?.totalPages);
      setCurrentPage(pagination?.currentPage ?? currentPage);
      setTotalItems(pagination?.totalItems);
      setCalendar(calendar || []);
    } catch (error) {
      console.error("Ошибка при получении данных:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(currentPage);
  }, [currentPage, pageSize]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        downloadMenuRef.current &&
        !downloadMenuRef.current.contains(e.target)
      ) {
        setShowDownloadMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  // Обработчик отправки формы
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    await fetchData(1, formData);
  };

  const handleSearch = (data = formData) => {
    setCurrentPage(1);
    fetchData(1, data, pageSize);
  };

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      await recalculateTimesheet(formData.month);
      await fetchData();
      showAlert(t("recalculateTimesheetSuccess"), "success");
    } catch (error) {
      console.error("Ошибка при пересчёте табеля:", error.message);
      showAlert(t("error"), "error");
    } finally {
      setRecalculating(false);
    }
  };

  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (type) => {
    setDownloading(true);
    setShowDownloadMenu(false);
    try {
      const { data: allData } = await getTimesheet({
        page: 1,
        pageSize: 99999,
        filters: buildRequestFilters(formData),
      });
      if (type === "summary")
        downloadAttendanceToExcel(
          allData,
          formData.month,
          sortField,
          sortOrder,
          weekDays,
        );
      else if (type === "full")
        downloadFullAttendanceToExcel(
          allData,
          formData.month,
          sortField,
          sortOrder,
          weekDays,
        );
      else
        downloadLatenessAttendanceToExcel(
          allData,
          formData.month,
          sortField,
          sortOrder,
          weekDays,
        );
    } catch (err) {
      console.error("Ошибка при скачивании:", err.message);
    } finally {
      setDownloading(false);
    }
  };

  const withEventsCount = data.filter((emp) =>
    Object.entries(emp.sessions || {}).some(([dayStr, s]) => {
      if (weekDaySet && !weekDaySet.has(Number(dayStr.split("-")[2])))
        return false;
      return s.events?.length > 0 || s.timeOff?.isCompanyPaid;
    }),
  ).length;
  const withoutEventsCount = data.length - withEventsCount;

  // Нерабочие дни месяца по производственному календарю (праздники и
  // перенесённые выходные), с учётом фильтра по дням недели
  const visibleHolidaysCount = useMemo(() => {
    const nonWorking = calendar.filter(
      (d) => d.day_type === "holiday" || d.day_type === "weekend",
    );
    if (!weekDaySet) return nonWorking.length;
    return nonWorking.filter((d) =>
      weekDaySet.has(Number(d.date.split("-")[2])),
    ).length;
  }, [calendar, weekDaySet]);

  return (
    <div className={styles.timesheetPage}>
      {loading ? (
        <Loading />
      ) : (
        <div className={styles.main}>
          {widgetsVisible && totalItems > 0 && (
            <div
              className={`${styles.statsGridWrap} ${widgetsScrollHidden ? styles.statsGridWrapHidden : ""}`}
            >
              <div className={styles.statsGridInner}>
                <div className={styles.statsGrid}>
                  <StatWidget
                    icon={Users}
                    color="#6366f1"
                    label={t("employees")}
                    value={totalItems}
                  />
                  <StatWidget
                    icon={PartyPopper}
                    color="#f59e0b"
                    label={t("holidaysLabel")}
                    value={visibleHolidaysCount}
                  />
                  <StatWidget
                    icon={UserCheck}
                    color="#22c55e"
                    label={t("withAttendance")}
                    value={withEventsCount}
                  />
                  <StatWidget
                    icon={UserX}
                    color="#ef4444"
                    label={t("withoutAttendance")}
                    value={withoutEventsCount}
                  />
                </div>
              </div>
            </div>
          )}
          <div className={styles.mainHeader}>
            <div className={styles.filterWrapper}>
              <Search formData={formData} setFormData={setFormData} onSearch={handleSearch} />

              <TimesheetFilter
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleFormSubmit}
                t={t}
              />
              <TimesheetSort
                sortField={sortField}
                sortOrder={sortOrder}
                onApply={handleSort}
              />
              <TimesheetColumnToggle
                visibleColumns={visibleColumns}
                onChange={(cols) => updateSettings("timesheet", { columns: cols })}
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
              <div className={styles.refreshBtn} onClick={() => fetchData()}>
                {Icons.refresh}
              </div>

              {isPastMonth && (
                <div
                  className={styles.refreshBtn}
                  title={t("recalculateTimesheetConfirm", { month: formData.month })}
                  onClick={() => !recalculating && handleRecalculate()}
                >
                  <Calculator size={16} className={recalculating ? styles.spinning : undefined} />
                </div>
              )}

              <div className={styles.downloadBtn}>
                {data.length > 0 && (
                  <div className={styles.downloadWrapper} ref={downloadMenuRef}>
                    <DownloadButton
                      text={t("save")}
                      loading={downloading}
                      onClick={() => setShowDownloadMenu((prev) => !prev)}
                    />
                    {showDownloadMenu && (
                      <div className={styles.downloadMenu}>
                        <button
                          className={styles.downloadMenuItem}
                          onClick={() => handleDownload("summary")}
                          disabled={downloading}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <rect
                              x="3"
                              y="3"
                              width="18"
                              height="18"
                              rx="2"
                              ry="2"
                            />
                            <line x1="3" y1="9" x2="21" y2="9" />
                            <line x1="3" y1="15" x2="21" y2="15" />
                            <line x1="9" y1="3" x2="9" y2="21" />
                          </svg>
                          <div className={styles.downloadMenuItemText}>
                            <span className={styles.downloadMenuItemTitle}>
                              {t("summaryTimesheet")}
                            </span>
                            <span className={styles.downloadMenuItemSub}>
                              {t("summaryData")}
                            </span>
                          </div>
                        </button>
                        <button
                          className={styles.downloadMenuItem}
                          onClick={() => handleDownload("full")}
                          disabled={downloading}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                          </svg>
                          <div className={styles.downloadMenuItemText}>
                            <span className={styles.downloadMenuItemTitle}>
                              {t("detailedTimesheet")}
                            </span>
                            <span className={styles.downloadMenuItemSub}>
                              {t("detailedData")}
                            </span>
                          </div>
                        </button>
                        <button
                          className={styles.downloadMenuItem}
                          onClick={() => handleDownload("lateness")}
                          disabled={downloading}
                        >
                          <Clock size={16} />
                          <div className={styles.downloadMenuItemText}>
                            <span className={styles.downloadMenuItemTitle}>
                              {t("latenessTimesheet")}
                            </span>
                            <span className={styles.downloadMenuItemSub}>
                              {t("latenessData")}
                            </span>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <Timesheet
            data={data}
            date={formData.month}
            weekDays={weekDays}
            calendar={calendar}
            currentPage={currentPage}
            pageSize={pageSize}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={handleSort}
            visibleColumns={visibleColumns}
            onScroll={handleTableScroll}
          />
        </div>
      )}
    </div>
  );
};

export default TimesheetPage;
