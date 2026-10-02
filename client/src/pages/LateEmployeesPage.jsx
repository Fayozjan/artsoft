import { useState, useEffect, useRef } from "react";

import { useTranslation } from "react-i18next";

import {
  getActiveBranches,
  getActivePositions,
  getLateEmployees,
} from "../api";

import LateTableFilter from "../components/LateTableFilter";
import Loading from "../components/Loading";
import LateCardList from "../components/LateCardList";
import LateCardListCarousel from "../components/LateCardListCarousel";
import Pagination from "../components/Pagination";
import DownloadButton from "../components/DownloadButton";

import { formatLateMinutesToHours } from "../helpers/time";
import MonthlyLateReport from "../components/MonthlyLateReport";

import EmployeeCell from "../components/EmployeeCell";
import Search from "../components/Search";
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

// "2026-08-01" → "01.08.2026" (без new Date — чтобы не ловить сдвиг по таймзоне)
const formatDayRu = (isoDay) => {
  const [y, m, d] = String(isoDay || "").split("-");
  return d ? `${d}.${m}.${y}` : String(isoDay || "");
};

// Порядок филиалов и должностей в Excel берём из справочников — как в выгрузке
// посещаемости. Без sort_order группы упорядочатся по алфавиту
async function fetchSortMaps() {
  try {
    const [branches, positions] = await Promise.all([
      getActiveBranches(),
      getActivePositions(),
    ]);

    return {
      branchSortMap: new Map(
        (branches.data || []).map((b) => [b.name, b.sort_order ?? 0]),
      ),
      positionSortMap: new Map(
        (positions.data || []).map((p) => [p.name, p.sort_order ?? 0]),
      ),
    };
  } catch (err) {
    console.error("не удалось загрузить sort_order справочников", err);
    return {};
  }
}

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
import { useImagePreviewStore } from "../stores/imagePreviewStore";
import { useAlertStore } from "../stores/alertStore";
import { Icons } from "../icons/icons";
import LateEmployeesTable from "../components/LateEmployeesTable";
import { useWidgetsStore } from "../stores/widgetsStore";

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
  // Итоги за весь период приходят с сервера: страница содержит только часть
  // сотрудников, по ней виджеты считать нельзя
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [viewType, setViewType] = useState("row");
  const [modalData, setModalData] = useState(null);
  const [formData, setFormData] = useState({
    mode: "day",
    date: new Date().toISOString().slice(0, 10),
    date_from: "",
    date_to: "",
    branch_ids: [],
    department_ids: [],
    employee_ids: [],
    position_ids: [],
    include_lunch_late: false,
    sort_by: "last_name",
    sort_order: "asc",
  });
  const [selectedMode, setSelectedMode] = useState("day");
  // Флаг из применённого запроса, а не из живой формы: колонки не должны
  // появляться/исчезать до нажатия «Применить»
  const [appliedIncludeLunch, setAppliedIncludeLunch] = useState(false);
  // Применённый диапазон режима «за период»: подпись над таблицей и колонки
  // сетки по филиалам должны меняться только после «Применить»
  const [appliedPeriod, setAppliedPeriod] = useState(null);
  const [exporting, setExporting] = useState(false);
  const { viewMode, activeBranchId } =
    useAuthStore((s) => s.userSettings) || {};

  const { t } = useTranslation();
  const { widgetsVisible } = useWidgetsStore();
  const openImagePreview = useImagePreviewStore((s) => s.open);
  const showAlert = useAlertStore((s) => s.showAlert);
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
        <EmployeeCell
          photo={item.employeePhoto}
          fullName={item.employeeFullName}
          id={item.employeeId}
          branch={item.branchName}
          department={item.departmentName}
          active={item.employeeStatus !== false}
        />
      ),
    },
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
      label: `${t("lateCol")} (${t("hhmmFormat")})`,
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
      label: t("latePhoto"),
      accessor: "actualStartPhoto",
      group: "day",
      render: (value) =>
        value ? (
          <img
            src={`/api/face-passes/image/${value}`}
            alt={t("latePhoto")}
            className={styles.latePhotoThumb}
            onClick={() =>
              openImagePreview(`/api/face-passes/image/${value}`)
            }
          />
        ) : (
          "—"
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

    ...(appliedIncludeLunch
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
    ...(appliedIncludeLunch
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
    const today = now.toISOString().slice(0, 10);

    // Период по умолчанию — с начала текущего месяца по сегодня
    const dateFields =
      formData.mode === "day"
        ? { date: today, date_from: "", date_to: "" }
        : formData.mode === "month"
          ? { date: now.toISOString().slice(0, 7), date_from: "", date_to: "" }
          : {
              date: "",
              date_from: `${today.slice(0, 8)}01`,
              date_to: today,
            };

    // Сбрасываем данные таблицы
    setSummary(null);
    setData(
      formData.mode === "day"
        ? []
        : { lateEmployeesByMonth: [], lateByBranchAndDay: [] },
    );

    // Полностью сбрасываем formData
    setFormData({
      mode: formData.mode,
      ...dateFields,
      branch_ids: [],
      department_ids: [],
      employee_ids: [],
      position_ids: [],
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
      const { data, summary: summaryTotals, pagination } = await getLateEmployees({
        page,
        pageSize: size,
        filters,
      });

      setAppliedIncludeLunch(!!filters.include_lunch_late);
      setAppliedPeriod(
        filters.mode === "period"
          ? { from: filters.date_from, to: filters.date_to }
          : null,
      );
      setData(data);
      setSummary(summaryTotals ?? null);
      setTotalPages(pagination?.totalPages);
      setCurrentPage(pagination?.currentPage ?? currentPage);
      setTotalItems(pagination?.totalItems);
    } catch (err) {
      // Раньше ошибка молча уходила в консоль и страница показывала «нет данных»
      const status = err.response?.status;
      const serverMessage = err.response?.data?.error || err.response?.data?.message;
      console.error("getLateEmployees failed", {
        status,
        mode: filters?.mode,
        date: filters?.date,
        message: serverMessage || err.message,
      });
      showAlert(
        serverMessage || `${t("error")}${status ? ` (${status})` : ""}`,
        "error",
      );
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

  // Excel выгружает весь отфильтрованный список, а не текущую страницу:
  // тянем данные отдельным запросом с pageSize=all
  const handleDownload = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { data: fullData } = await getLateEmployees({
        page: 1,
        pageSize: "all",
        filters: formData,
      });

      if (formData.mode === "day") {
        await DownloadLate.day(fullData || [], formData.date);
        return;
      }

      const isPeriod = formData.mode === "period";

      if (viewType === "employees") {
        await DownloadLate.monthByEmployee(
          fullData?.lateEmployeesByMonth || [],
          isPeriod ? formData.date_from : formData.date,
          appliedIncludeLunch,
          await fetchSortMaps(),
          isPeriod ? formData.date_to : null,
        );
      } else {
        await DownloadLate.monthByBranch(
          fullData?.lateByBranchAndDay || [],
          isPeriod ? formData.date_from : formData.date,
          isPeriod ? formData.date_to : null,
        );
      }
    } catch (err) {
      console.error("export failed", err);
      showAlert(
        err.response?.data?.error || err.message || t("error"),
        "error",
      );
    } finally {
      setExporting(false);
    }
  };

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

  const handleSearch = (data = formData) => {
    setCurrentPage(1);
    fetchData(1, data, pageSize);
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
  // Пока сводки нет (старый ответ сервера) — считаем по загруженным строкам
  const sumBy = (fn) => lateItems.reduce((acc, item) => acc + (fn(item) || 0), 0);
  const lateEmployeesCount =
    summary?.lateEmployeesCount ?? (totalItems || lateItems.length);
  const totalLateMinutes =
    summary?.totalLateMinutes ??
    sumBy((b) => b.lateMinutes || b.monthlyLateMinutes);
  const totalArrivalLateCount =
    summary?.totalArrivalLateCount ?? sumBy((b) => b.monthlyArrivalLateCount);
  const totalBreakReturnCount =
    summary?.totalLunchLateCount ?? sumBy((b) => b.monthlyLunchLateCount);
  const totalBreakReturnMinutes =
    summary?.totalBreakReturnMinutes ??
    sumBy((b) => b.monthlyBreakReturnLateMinutes);
  const totalLateMoney =
    summary?.totalLateMoney ?? sumBy((b) => Number(b.monthlyLateMoney));

  return (
    <div className={styles.lateEmployeesPage}>
      {loading ? (
        <Loading />
      ) : (
        <div className={styles.main}>
          {widgetsVisible && (lateEmployeesCount > 0 || lateItems.length > 0) && (
            <div
              className={`${styles.statsGridWrap} ${widgetsScrollHidden ? styles.statsGridWrapHidden : ""}`}
            >
              <div className={styles.statsGridInner}>
                <div className={styles.statsGrid}>
              <StatWidget
                icon={Users}
                color="#ef4444"
                label={t("lateEmployeesLabel")}
                value={lateEmployeesCount}
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
                  lateEmployeesCount > 0
                    ? Math.round(totalLateMinutes / lateEmployeesCount)
                    : 0,
                )}
                sub={t("hoursShort")}
              />
              {selectedMode !== "day" && totalArrivalLateCount > 0 && (
                <StatWidget
                  icon={Clock}
                  color="#dc2626"
                  label={t("lateOccurrences")}
                  value={totalArrivalLateCount}
                />
              )}
              {selectedMode !== "day" &&
                appliedIncludeLunch &&
                totalBreakReturnCount > 0 && (
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
              {selectedMode !== "day" && totalLateMoney > 0 && (
                <StatWidget
                  icon={Wallet}
                  color="#6366f1"
                  label={t("latePenaltyAmount")}
                  value={fmt(totalLateMoney)}
                />
              )}
                </div>
              </div>
            </div>
          )}
          <div className={styles.mainHeader}>
            <div className={styles.filterWrapper}>
              <Search formData={formData} setFormData={setFormData} onSearch={handleSearch} />

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
                      onClick={handleDownload}
                      loading={exporting}
                    />
                  )
                : data?.lateEmployeesByMonth?.length > 0 && (
                    <DownloadButton
                      text={t("save")}
                      onClick={handleDownload}
                      loading={exporting}
                    />
                  )}
            </div>
          </div>

          {selectedMode === "day" ? (
            formData.date ? (
              viewType === "row" ? (
                <LateEmployeesTable
                  onScroll={handleTableScroll}
                  columns={dayColumns}
                  data={data}
                  date={formData.date}
                />
              ) : viewType === "card" ? (
                <LateCardList
                  data={Array.isArray(data) ? data : []}
                  includeLunch={appliedIncludeLunch}
                />
              ) : (
                <LateCardListCarousel
                  data={Array.isArray(data) ? data : []}
                  includeLunch={appliedIncludeLunch}
                />
              )
            ) : (
              <></>
            )
          ) : (
            <>
              {appliedPeriod && (
                <div className={styles.periodCaption}>
                  <span className={styles.periodCaptionLabel}>
                    {t("period")}
                  </span>
                  <span className={styles.periodCaptionValue}>
                    {formatDayRu(appliedPeriod.from)} —{" "}
                    {formatDayRu(appliedPeriod.to)}
                  </span>
                </div>
              )}
              <MonthlyLateReport
                onMore={setModalData}
                data={data || []}
                viewType={viewType}
                includeLunch={appliedIncludeLunch}
                dateFrom={appliedPeriod?.from ?? null}
                dateTo={appliedPeriod?.to ?? null}
              />
            </>
          )}
        </div>
      )}

      {modalData && (
        <LateEmployeeModal
          modalData={modalData}
          onClose={() => setModalData(null)}
          includeLunch={appliedIncludeLunch}
        />
      )}
    </div>
  );
};

export default LateEmployeesPage;
