import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { downloadEmployeesAtWorkToExcel } from "../utils/DocGenerator";
import { getAttendance } from "../api";

import Loading from "../components/Loading";
import DownloadButton from "../components/DownloadButton";
import AttendanceTableFilter from "../components/AttendanceTableFilter";
import { AttendanceDashboard } from "../components/AttendanceDashboard";
import AttendanceTable from "../components/AttendanceTable";

import styles from "./AttendancePageWeb.module.scss";
import { useAuthStore } from "../stores/authStore";
import { Icons } from "../icons/icons";

export const isToday = (dateString) => {
  if (!dateString) return false;

  const today = new Date().toISOString().slice(0, 10);
  return dateString === today;
};

const AttendancePageWeb = () => {
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const { viewMode, activeBranchId } =
    useAuthStore((s) => s.userSettings) || {};
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    branch_id: "",
    department_id: "",
  });

  const [loadedDataDate, setLoadedDataDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const fetchData = async (filters = formData) => {
    setLoading(true);

    try {
      const { data } = await getAttendance({ filters });
      setData(data);
      setLoadedDataDate(filters.date);
    } catch (error) {
      console.error("Ошибка при получении данных:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === "branch") {
      fetchData(formData);
    }
  }, [activeBranchId]);

  useEffect(() => {
    fetchData(formData);
  }, []);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    await fetchData(formData);
  };

  const showAllDashboards = isToday(loadedDataDate);

  return (
    <div className={styles.attendancePage}>
      {loading && <Loading />}
      <div className={styles.main}>
        <div className={styles.mainHeader}>
          <div className={styles.filterWrapper}>
            <AttendanceTableFilter
              formData={formData}
              setFormData={setFormData}
              onSubmit={handleFormSubmit}
              t={t}
            />
          </div>

          <div className={styles.buttonsWrapper}>
            <div className={styles.refreshBtn} onClick={() => fetchData()}>
              {Icons.refresh}
            </div>

            {Object.keys(data).length > 0 && (
              <DownloadButton
                text={t("save")}
                onClick={
                  formData.mode === "month"
                    ? () => downloadEmployeesAtWorkToExcel(data, formData.date)
                    : () => downloadEmployeesAtWorkToExcel(data, formData.date)
                }
              />
            )}
          </div>
        </div>

        <AttendanceDashboard
          data={data}
          showAllCards={showAllDashboards}
          viewMode={viewMode}
        />
        <AttendanceTable rowData={data} viewMode={viewMode} />
      </div>
    </div>
  );
};

export default AttendancePageWeb;
