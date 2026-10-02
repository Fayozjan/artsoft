import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { createCronTask } from "../api";
import {
  CRON_TASK_REGISTRY,
  CRON_TASK_TYPES,
  getCronTaskDefaults,
  getCronTaskType,
} from "./cronTaskConfigs/registry";

import Button from "./Button";
import Loading from "./Loading";
import CronScheduleFields from "./CronScheduleFields";

import styles from "./AddCronTask.module.scss";

const DEFAULT_TASK_TYPE = "attendance_report";

const initialFormData = () => ({
  name: "",
  task_type: DEFAULT_TASK_TYPE,
  schedule_kind: "daily",
  hour: 9,
  minute: 0,
  days_of_week: [1, 2, 3, 4, 5],
  interval_minutes: null,
  config: getCronTaskDefaults(DEFAULT_TASK_TYPE),
});

const AddCronTask = ({ handleClose, onSuccess }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const { showAlert } = useAlertStore();
  const [formData, setFormData] = useState(initialFormData);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await createCronTask(formData);

      if (res.success) {
        showAlert(t("success"), "success");
        onSuccess();
        setTimeout(handleClose, 1500);
      } else {
        showAlert(t("error"), "error");
      }
    } catch (error) {
      showAlert(error.response?.data?.error || t("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  const ConfigForm = getCronTaskType(formData.task_type)?.Config;

  return (
    <form className={styles.addCronTask} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("addCronTask")}</h2>
        <Button text={t("save")} type="submit" />
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("name")}</label>
          <input type="text" name="name" value={formData.name} onChange={handleChange} required />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("taskType")}</label>
          <select
            name="task_type"
            value={formData.task_type}
            onChange={(e) => {
              const task_type = e.target.value;
              setFormData((prev) => ({ ...prev, task_type, config: getCronTaskDefaults(task_type) }));
            }}
          >
            {CRON_TASK_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(CRON_TASK_REGISTRY[type].labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <CronScheduleFields value={formData} onChange={setFormData} />

      {ConfigForm && (
        <ConfigForm
          config={formData.config}
          onChange={(config) => setFormData((prev) => ({ ...prev, config }))}
        />
      )}

      {loading && <Loading />}
    </form>
  );
};

export default AddCronTask;
