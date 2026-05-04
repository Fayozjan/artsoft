import { useState, useEffect } from "react";
import { useAlertStore } from "../stores/alertStore";
import { useTranslation } from "react-i18next";

import { addTelegramBot, EmployeeService } from "../api";

import Button from "./Button";
import MultiSelectEmployees from "./MultiSelectEmployees";

import styles from "./AddTelegramBot.module.scss";

const AddTelegramBot = ({ handleClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    chat_id: null,
    selectedEmployeeIds: "",
    receive_attendance_report: null,
    receive_event_alerts: null,
    receive_late_report: null,
  });
  const [employees, setEmployees] = useState([]);
  const { showAlert } = useAlertStore();
  const { t } = useTranslation();

  const fetchData = async () => {
    try {
      const employees = await EmployeeService.getActive();
      if (employees.success) {
        setEmployees(employees.data);
      }
    } catch (error) {
      console.error("Ошибка при получении данных:", error.message);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

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
      const res = await addTelegramBot(formData);

      if (res.success) {
        showAlert(t("success"), "success");
        onSuccess();
        setTimeout(handleClose, 1500);
      } else {
        console.log("Ошибка в ответе сервера:", res.data);
      }
    } catch (error) {
      console.error(
        "Ошибка при отправке данных:",
        error.response ? error.response.data : error.message,
      );
      showAlert(t("error"), "error");
    }
  };

  return (
    <form className={styles.addTelegramBot} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("addTelegramBot")}</h2>
        <Button text={t("save")} type={"submit"} />
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("name")}</label>
          <input
            type="text"
            name="name"
            value={formData.name}
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
            value={formData.chat_id}
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
            selected={formData.selectedEmployeeIds}
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
    </form>
  );
};

export default AddTelegramBot;
