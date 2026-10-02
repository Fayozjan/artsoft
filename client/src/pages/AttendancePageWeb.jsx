import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { downloadAttendanceAllSheets } from "../utils/DocGenerator";
import { prepareAttendanceData } from "../utils/prepareAttendanceData";
import { prepareAttendancePeriodData } from "../utils/prepareAttendancePeriodData";
import { getAttendance } from "../api";

import Loading from "../components/Loading";
import DownloadButton from "../components/DownloadButton";
import { AttendanceDashboard } from "../components/AttendanceDashboard";
import AttendancePeriodDashboard from "../components/AttendancePeriodDashboard";
import AttendanceTable from "../components/AttendanceTable";
import AttendancePeriodTable from "../components/AttendancePeriodTable";

import styles from "./AttendancePageWeb.module.scss";
import { useAuthStore } from "../stores/authStore";
import { Icons } from "../icons/icons";

export const isToday = (dateString) => {
  if (!dateString) return false;

  const today = new Date().toISOString().slice(0, 10);
  return dateString === today;
};

const today = () => new Date().toISOString().slice(0, 10);

// Одна дата в обе стороны — режим «за день», разные — режим «за период»
const buildFilters = ({ from, to }) =>
  from === to
    ? { mode: "day", date: from }
    : { mode: "period", date_from: from, date_to: to };

const AttendancePageWeb = () => {
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const { viewMode, activeBranchId } =
    useAuthStore((s) => s.userSettings) || {};

  const [range, setRange] = useState({ from: today(), to: today() });

  // Режим показанных данных — обновляется только после загрузки,
  // чтобы таблица не переключалась во время выбора дат
  const [applied, setApplied] = useState({ mode: "day", date: today() });

  const fetchData = async (nextRange = range) => {
    const filters = buildFilters(nextRange);

    setLoading(true);

    try {
      const { data } = await getAttendance({ filters });
      setData(data);
      setApplied({ mode: filters.mode, date: nextRange.from });
    } catch (error) {
      console.error("Ошибка при получении данных:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === "branch") {
      fetchData(range);
    }
  }, [activeBranchId]);

  useEffect(() => {
    fetchData(range);
  }, []);

  // Дата окончания не может быть раньше даты начала — подтягиваем вторую границу
  const handleRangeChange = (field) => (e) => {
    const value = e.target.value;
    if (!value) return;

    const next =
      field === "from"
        ? { from: value, to: range.to < value ? value : range.to }
        : { from: range.from > value ? value : range.from, to: value };

    setRange(next);
    fetchData(next);
  };

  const isPeriod = applied.mode === "period";

  const periodRows = useMemo(
    () =>
      isPeriod
        ? prepareAttendancePeriodData(data, {
            noBranch: t("noBranch"),
            noDepartment: t("noDepartment"),
          })
        : [],
    [data, isPeriod],
  );

  const showAllDashboards = isToday(applied.date);

  return (
    <div className={styles.attendancePage}>
      {loading && <Loading />}
      <div className={styles.main}>
        <div className={styles.mainHeader}>
          <div className={styles.filterWrapper}>
            <div className={styles.dateRange}>
              <label>
                <span>{t("dateFrom")}</span>
                <input
                  type="date"
                  value={range.from}
                  max={range.to}
                  onChange={handleRangeChange("from")}
                  onFocus={(e) => e.target.showPicker?.()}
                />
              </label>

              <label>
                <span>{t("dateTo")}</span>
                <input
                  type="date"
                  value={range.to}
                  min={range.from}
                  onChange={handleRangeChange("to")}
                  onFocus={(e) => e.target.showPicker?.()}
                />
              </label>
            </div>
          </div>

          <div className={styles.buttonsWrapper}>
            <div className={styles.refreshBtn} onClick={() => fetchData()}>
              {Icons.refresh}
            </div>

            {!isPeriod && data?.employees?.length > 0 && (
              <DownloadButton
                text={t("save")}
                onClick={() => {
                  const processed = prepareAttendanceData(data);
                  downloadAttendanceAllSheets(processed, applied.date);
                }}
              />
            )}
          </div>
        </div>

        {isPeriod ? (
          <>
            <AttendancePeriodDashboard
              data={data}
              rows={periodRows}
              viewMode={viewMode}
            />
            <AttendancePeriodTable
              days={data?.days || []}
              viewMode={viewMode}
              period={{ from: range.from, to: range.to }}
            />
          </>
        ) : (
          <>
            <AttendanceDashboard
              data={data}
              showAllCards={showAllDashboards}
              viewMode={viewMode}
            />
            <AttendanceTable rowData={data} viewMode={viewMode} />
          </>
        )}
      </div>
    </div>
  );
};

export default AttendancePageWeb;
