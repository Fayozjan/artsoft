import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { EmployeeService, getTimeOffById, updateTimeOff } from "../api";
import { formatIsoToDateTimeLocal } from "../utils/date";
import { useAlertStore } from "../stores/alertStore";

import Button from "./Button";
import Loading from "./Loading";
import SelectEmployee from "./SelectEmployee";

import styles from "./AddTimeOff.module.scss";

const EditTimeOff = ({ id, handleClose, onSuccess }) => {
  const { t } = useTranslation();
  const [employees, setEmployees] = useState([]);
  const { showAlert } = useAlertStore();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({});

  const fetchData = async () => {
    try {
      const response = await getTimeOffById(id);
      const perm = response.data;
      if (["day_off", "vacation"].includes(perm.type)) {
        setFormData({
          ...perm,
          date_from: perm.date_from.split("T")[0],
          date_to: perm.date_to.split("T")[0],
        });
      } else {
        setFormData({
          ...perm,
          date_from: formatIsoToDateTimeLocal(perm.date_from),
          date_to: formatIsoToDateTimeLocal(perm.date_to),
        });
      }
    } catch (err) {
      console.log(err.message);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const employees = await EmployeeService.getActive();
      if (employees.success) {
        setEmployees(employees.data);
      }
    } catch (error) {
      console.error("Ошибка при получении данных:", error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchEmployees();
  }, [id]);

  // Обработчик изменения формы
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    if (name === "is_company_paid") {
      setFormData((prevData) => ({ ...prevData, [name]: value === "true" }));
    } else {
      setFormData((prevData) => ({ ...prevData, [name]: value }));
    }
  }, []);

  // Отправка формы
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.date_from || !formData.date_to) {
      showAlert(t("selectDate"), "error");
      return;
    }

    const payload = { ...formData };
    if (!["day_off", "vacation"].includes(payload.type)) {
      if (payload.date_from) payload.date_from = new Date(payload.date_from + ":00+05:00").toISOString();
      if (payload.date_to) payload.date_to = new Date(payload.date_to + ":00+05:00").toISOString();
    }

    try {
      await updateTimeOff(id, payload);

      showAlert(t("success"), "success");
      onSuccess();
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      showAlert(t("error"), "error");
    }
  };

  return (
    <form className={styles.addTimeOff} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("editTimeOff")}</h2>
        <Button text={t("save")} type={"submit"} />
      </div>

      <div className={styles.row}>
        <div>
          <label htmlFor="absence-type">{t("type")}</label>
          <select
            id="absence-type"
            name="type"
            value={formData?.type || ""}
            onChange={handleChange}
          >
            <option value="hour_off">{t("hour")}</option>
            <option value="day_off">{t("day_off")}</option>
            <option value="vacation">{t("vacation")}</option>
          </select>
        </div>

        <div>
          <label>{t("companyPaid")}</label>
          <select
            name="is_company_paid"
            onChange={handleChange}
            value={String(formData?.is_company_paid ?? "false")}
          >
            <option value="false">{t("no")}</option>
            <option value="true">{t("yes")}</option>
          </select>
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("filterFrom")}</label>
          <input
            type={
              ["day_off", "vacation"].includes(formData.type)
                ? "date"
                : "datetime-local"
            }
            name="date_from"
            value={formData.date_from}
            onChange={handleChange}
            required
            onFocus={(e) => e.target.showPicker?.()}
          />
        </div>
        <div>
          <label>{t("filterTo")}</label>
          <input
            type={
              ["day_off", "vacation"].includes(formData.type)
                ? "date"
                : "datetime-local"
            }
            name="date_to"
            value={formData.date_to}
            onChange={handleChange}
            required
            onFocus={(e) => e.target.showPicker?.()}
          />
        </div>
        {formData?.type === "day" && (
          <div className={styles.row_item}>
            <label>{t("creditedHoursPerDay")}</label>
            <input
              type="number"
              name="credited_hours"
              value={formData.credited_hours || ""}
              onChange={handleChange}
              min="0"
              max="8"
              step="1"
              required
            />
          </div>
        )}
      </div>

      <div className={styles.row}>
        <div className={styles.row_item_user}>
          <label className={styles.label}>{t("employee")}</label>
          <SelectEmployee
            data="employee"
            options={employees}
            defaultValue={formData?.employee_id}
            setFormData={setFormData}
            required="required"
          />
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.row_item}>
          <label>{t("reason")}</label>
          <input
            type="text"
            name="reason"
            value={formData.reason}
            onChange={handleChange}
          />
        </div>
      </div>

      {loading && <Loading />}
    </form>
  );
};

export default EditTimeOff;
