import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import {
  downloadAttendanceToExcel,
  downloadFullAttendanceToExcel,
} from "../utils/DownloadAttendanceToExcel";
import { getTimesheet } from "../api";

import Loading from "../components/Loading";
import { Timesheet } from "../features/timesheet";

import Pagination from "../components/Pagination";
import TimesheetFilter from "../components/TimesheetFilter";
import DownloadButton from "../components/DownloadButton";

import styles from "./TimesheetPage.module.scss";
import { Users, CalendarDays, PartyPopper } from "lucide-react";

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
  const [holidays, setHolidays] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(1);
  const { t } = useTranslation();
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const downloadMenuRef = useRef(null);

  const [formData, setFormData] = useState({
    month: getCurrentMonth(),
    branch_id: null,
    department_id: null,
    position_id: null,
  });

  const fetchData = async (
    page = currentPage,
    filters = formData,
    size = pageSize,
  ) => {
    setLoading(true);
    try {
      const { data, pagination, holidays } = await getTimesheet({
        page,
        pageSize: size,
        filters,
      });

      setData(data);
      setTotalPages(pagination?.totalPages);
      setCurrentPage(pagination?.currentPage ?? currentPage);
      setTotalItems(pagination?.totalItems);
      setHolidays(holidays || []);
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

  const handleSearch = () => {
    setCurrentPage(1);
    fetchData(1, formData, pageSize);
  };

  const workingDays = (() => {
    if (!formData.month) return 0;
    const [y, m] = formData.month.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(y, m - 1, d).getDay();
      if (dow !== 0 && dow !== 6) count++;
    }
    return count;
  })();

  return (
    <div className={styles.timesheetPage}>
      {loading ? (
        <Loading />
      ) : (
        <div className={styles.main}>
          {totalItems > 0 && (
            <div className={styles.statsGrid}>
              <StatWidget
                icon={Users}
                color="#6366f1"
                label="Сотрудников"
                value={totalItems}
              />
              <StatWidget
                icon={CalendarDays}
                color="#10b981"
                label="Раб. дней"
                value={workingDays}
              />
              <StatWidget
                icon={PartyPopper}
                color="#f59e0b"
                label="Праздников"
                value={holidays.length}
              />
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

              <TimesheetFilter
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

              <div className={styles.downloadBtn}>
                {data.length > 0 && (
                  <div className={styles.downloadWrapper} ref={downloadMenuRef}>
                    <DownloadButton
                      text={t("save")}
                      onClick={() => setShowDownloadMenu((prev) => !prev)}
                    />
                    {showDownloadMenu && (
                      <div className={styles.downloadMenu}>
                        <button
                          className={styles.downloadMenuItem}
                          onClick={() => {
                            downloadAttendanceToExcel(data, formData.month);
                            setShowDownloadMenu(false);
                          }}
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
                              Сводный табель
                            </span>
                            <span className={styles.downloadMenuItemSub}>
                              Итоговые данные
                            </span>
                          </div>
                        </button>
                        <button
                          className={styles.downloadMenuItem}
                          onClick={() => {
                            downloadFullAttendanceToExcel(data, formData.month);
                            setShowDownloadMenu(false);
                          }}
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
                              Детальный табель
                            </span>
                            <span className={styles.downloadMenuItemSub}>
                              Подробные данные
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
            holidays={holidays}
            currentPage={currentPage}
            pageSize={pageSize}
          />
        </div>
      )}
    </div>
  );
};

export default TimesheetPage;
