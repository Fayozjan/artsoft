import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { downloadEmployeesAtWorkToExcel } from "../utils/DocGenerator";
import { getAttendance } from "../api";

import Loading from "../components/Loading";
import DownloadButton from "../components/DownloadButton";
import AttendanceTableFilter from "../components/AttendanceTableFilter";
import { AttendanceDashboard } from "../components/AttendanceDashboard";
import AttendanceTable from "../components/AttendanceTable";

import styles from "./AttendancePage.module.scss";

export const isToday = (dateString) => {
  if (!dateString) return false;

  const today = new Date().toISOString().slice(0, 10);
  return dateString === today;
};

const AttendancePage = () => {
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();
  const [data, setData] = useState([]);

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

        <AttendanceDashboard data={data} showAllCards={showAllDashboards} />
        <AttendanceTable rowData={data} />
      </div>
    </div>
  );
};

export default AttendancePage;
