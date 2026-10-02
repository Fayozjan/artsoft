import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { EmployeeService, getActiveWorkSchedules } from "../api";
import Button from "./Button";

import styles from "./AddWorkSchedule.module.scss";

const today = () => new Date().toISOString().slice(0, 10);

const BulkChangeWorkSchedule = ({ employeeIds, handleClose, onSuccess }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const [workSchedules, setWorkSchedules] = useState([]);
  const [workScheduleId, setWorkScheduleId] = useState("");
  const [startDate, setStartDate] = useState(today());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getActiveWorkSchedules().then((res) => setWorkSchedules(res.data || []));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!workScheduleId) {
      showAlert(t("select"), "error");
      return;
    }

    setLoading(true);
    try {
      const res = await EmployeeService.bulkUpdateWorkSchedule(
        employeeIds,
        workScheduleId,
        startDate,
      );
      showAlert(t("saved"), "success");
      onSuccess?.(res);
      setTimeout(handleClose, 1000);
    } catch (err) {
      showAlert(err.response?.data?.error || t("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={styles.addWorkSchedules} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>
          {t("bulkChangeWorkSchedule")} ({employeeIds.length})
        </h2>
        <Button text={t("apply")} type="submit" disabled={loading} loading={loading} />
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("workSchedule")}</label>
          <select
            value={workScheduleId}
            onChange={(e) => setWorkScheduleId(e.target.value)}
            required
          >
            <option value="">{t("select")}</option>
            {workSchedules.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>{t("workScheduleStartDate")}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
      </div>
    </form>
  );
};

export default BulkChangeWorkSchedule;
