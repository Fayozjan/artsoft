import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { getCronTaskById, updateCronTask, runCronTaskNow } from "../api";
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

// last_run_error хранит "chatId: сообщение" через "; " (см. sendDocumentToChats на сервере) —
// вытаскиваем сами chat_id, чтобы подсветить их в ChatIdsInput.
function parseFailedChatIds(lastRunError) {
  if (!lastRunError) return [];
  return lastRunError
    .split(";")
    .map((part) => part.split(":")[0].trim())
    .filter(Boolean);
}

const EditCronTask = ({ id, handleClose, onSuccess }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const { showAlert } = useAlertStore();
  const [formData, setFormData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await getCronTaskById(id);
        if (res.success) {
          const config = res.data.config || {};
          // Старые задачи хранили одиночный chat_id — нормализуем к списку.
          const chat_ids = Array.isArray(config.chat_ids)
            ? config.chat_ids
            : config.chat_id
              ? [config.chat_id]
              : [];
          setFormData({
            ...res.data,
            schedule_kind: res.data.schedule_kind || "daily",
            days_of_week: res.data.days_of_week || [],
            config: config.chat_id || config.chat_ids ? { ...config, chat_ids } : config,
          });
        }
      } catch (error) {
        console.error("Ошибка загрузки задачи:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await updateCronTask(id, formData);

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

  const handleRunNow = async () => {
    setRunning(true);
    try {
      await runCronTaskNow(id);
      showAlert(t("success"), "success");
      onSuccess();
    } catch (error) {
      showAlert(error.response?.data?.error || t("error"), "error");
    } finally {
      setRunning(false);
    }
  };

  if (!formData) {
    return loading ? <Loading /> : null;
  }

  const ConfigForm = getCronTaskType(formData.task_type)?.Config;

  return (
    <form className={styles.addCronTask} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("editCronTask")}</h2>
        <div className={styles.headerActions}>
          <button type="button" className={styles.runNowBtn} onClick={handleRunNow} disabled={running}>
            {running ? t("loading") : t("runNow")}
          </button>
          <Button text={t("save")} type="submit" />
        </div>
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
              // Конфиги типов несовместимы между собой — сбрасываем на дефолтный для нового типа.
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
          failedChatIds={parseFailedChatIds(formData.last_run_error)}
        />
      )}

      <div className={styles.row}>
        <div>
          <label>{t("status")}</label>
          <select
            name="status"
            value={String(formData.status)}
            onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value === "true" }))}
          >
            <option value="true">{t("enable")}</option>
            <option value="false">{t("disable")}</option>
          </select>
        </div>
      </div>

      {loading && <Loading />}
    </form>
  );
};

export default EditCronTask;
