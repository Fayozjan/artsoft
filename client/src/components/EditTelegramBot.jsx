import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";

import { editTelegramBot, EmployeeService, getTelegramBot } from "../api";

import Button from "./Button";
import MultiSelectEmployees from "./MultiSelectEmployees";

import styles from "./AddTelegramBot.module.scss";

const EditTelegramBot = ({ id, handleClose, onSuccess }) => {
  const { showAlert } = useAlertStore();
  const { t } = useTranslation();
  const [employees, setEmployees] = useState([]);
  const [formData, setFormData] = useState({
    name: null,
    id: null,
    chat_id: null,
    selectedEmployeeIds: null,
    receive_attendance_report: null,
    receive_event_alerts: null,
    receive_late_report: null,
    status: null,
  });

  useEffect(() => {
    const fetchPosition = async () => {
      try {
        const [telegramBotRes, employeeRes] = await Promise.all([
          getTelegramBot(id),
          EmployeeService.getActive(),
        ]);

        if (telegramBotRes.success) {
          setFormData(telegramBotRes.data);
        } else {
          console.error("Ошибка при получении данных телеграм бота");
        }

        if (employeeRes.success) {
          setEmployees(employeeRes.data);
        } else {
          console.error("Ошибка при получении списка сотрудников");
        }
      } catch (error) {
        console.error("Ошибка при загрузке данных:", error.message);
        showAlert(t("error"), "error");
        setTimeout(() => handleClose(), 1500);
      }
    };

    fetchPosition();
  }, [id]);

  const handleSelectionChange = (selected) => {
    setFormData((prevData) => ({
      ...prevData,
      selectedEmployeeIds: selected,
    }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await editTelegramBot(id, formData);
      if (res.success) {
        showAlert(t("success"), "success");
        onSuccess();
        const timer = setTimeout(() => {
          handleClose();
        }, 1500);

        return () => clearTimeout(timer);
      } else {
        console.log("Ошибка в ответе сервера:", res.data);
      }
    } catch (error) {
      console.error(
        "Ошибка при обновлении данных:",
        error.response ? error.response.data : error.message,
      );
      showAlert(t("error"), "error");
    }
  };

  return (
    <form className={styles.addTelegramBot} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("editTelegramBot")}</h2>
        <Button text={t("save")} type={"submit"} />
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("name")}</label>
          <input
            type="text"
            name="name"
            value={formData?.name}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("telegramChat")}</label>
          <input
            type="text"
            name="chat_id"
            value={formData?.chat_id}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label className={styles.label}>
            {t("employees")}
            <span className={styles.sticker}>
              {formData?.selectedEmployeeIds?.length || 0}
            </span>
          </label>

          <MultiSelectEmployees
            options={employees}
            selected={formData?.selectedEmployeeIds}
            onChange={handleSelectionChange}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("access")}</label>
          <div className={styles.status}>
            <label>
              <input
                type="checkbox"
                checked={formData.receive_event_alerts === true}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    receive_event_alerts: e.target.checked,
                  }))
                }
              />
              {t("receiveEvents")}
            </label>

            <label>
              <input
                type="checkbox"
                checked={formData.receive_attendance_report === true}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    receive_attendance_report: e.target.checked,
                  }))
                }
              />
              {t("receiveAttendance")}
            </label>

            <label>
              <input
                type="checkbox"
                checked={formData.receive_late_report === true}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    receive_late_report: e.target.checked,
                  }))
                }
              />
              {t("receiveLate")}
            </label>
          </div>
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label htmlFor="status">{t("status")}</label>
          <select
            name="status"
            value={formData?.status}
            onChange={handleChange}
          >
            <option value="true">{t("enable")}</option>
            <option value="false">{t("disable")}</option>
          </select>
        </div>
      </div>
    </form>
  );
};

export default EditTelegramBot;
