import { useState, useEffect, useCallback } from "react";
import { useAlertStore } from "../stores/alertStore";
import { useTranslation } from "react-i18next";
import { createTimeOff, EmployeeService } from "../api";

import MultiSelectEmployees from "./MultiSelectEmployees";
import Button from "./Button";

import styles from "./AddTimeOff.module.scss";
import Loading from "./Loading";

const AddTimeOff = ({ handleClose, onSuccess }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const { showAlert } = useAlertStore();
  const [employees, setEmployees] = useState([]);

  const [formData, setFormData] = useState({
    selectedEmployeeIds: [],
    type: "hour",
    reason: "",
    date_from: null,
    date_to: null,
    credited_hours: 0,
    is_company_paid: false,
  });

  const fetchData = async () => {
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

  // Загрузка справочных данных
  useEffect(() => {
    fetchData();
  }, []);

  // Обработчик изменения формы
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    if (name === "is_company_paid") {
      setFormData((prevData) => ({ ...prevData, [name]: value === "true" }));
    } else {
      setFormData((prevData) => ({ ...prevData, [name]: value }));
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await createTimeOff(formData);

      if (res.success) {
        showAlert(t("success"), "success");
        onSuccess();
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        showAlert(t("error"), "error");
      }
    } catch (error) {
      showAlert(t("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectionChange = (selected) => {
    setFormData((prevData) => ({
      ...prevData,
      selectedEmployeeIds: selected,
    }));
  };

  const closeAlert = () => setAlert((prev) => ({ ...prev, show: false }));

  return (
    <form className={styles.addTimeOff} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("addTimeOff")}</h2>
        <Button text={t("save")} type={"submit"} />
      </div>

      <div className={styles.row}>
        <div>
          <label>Тип</label>
          <select name="type" onChange={handleChange}>
            <option value="hour_off">Отгул (почасовой)</option>
            <option value="day_off">Отгул (день)</option>
            <option value="vacation">Отпуск</option>
          </select>
        </div>

        <div>
          <label>За счет компании</label>
          <select name="is_company_paid" onChange={handleChange}>
            <option value="false">Нет</option>
            <option value="true">Да</option>
          </select>
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label> Дата от</label>
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
          <label> Дата до</label>
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
            <label>Часы в учёт (в день)</label>
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
          <label className={styles.label}>
            Сотрудник
            <span className={styles.sticker}>
              {formData?.selectedEmployeeIds?.length || 0}
            </span>
          </label>
          <MultiSelectEmployees
            options={employees}
            selected={formData.selectedEmployeeIds}
            onChange={handleSelectionChange}
            required="required"
          />
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.row_item}>
          <label>Причина</label>
          <input
            type="text"
            name="reason"
            value={formData.reason}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      {loading && <Loading />}
    </form>
  );
};

export default AddTimeOff;
