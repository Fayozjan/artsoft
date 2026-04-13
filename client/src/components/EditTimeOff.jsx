import { useState, useEffect, useCallback } from "react";
import { t } from "i18next";

import { EmployeeService, getTimeOffById, updateTimeOff } from "../api";
import { formatIsoToDateTimeLocal } from "../utils/date";
import { useAlertStore } from "../stores/alertStore";

import Button from "./Button";
import Loading from "./Loading";
import SelectEmployee from "./SelectEmployee";

import styles from "./AddTimeOff.module.scss";

const EditTimeOff = ({ id, handleClose, onSuccess }) => {
  const [employees, setEmployees] = useState([]);
  const { showAlert } = useAlertStore();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({});

  const fetchData = async () => {
    try {
      const data = await getTimeOffById(id);
      const perm = data.data;
      console.log("perm", perm);
      if (perm.type === "day") {
        setFormData({
          ...perm,
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
      showAlert("Выберите дату", "error");
      return;
    }

    const payload = {
      ...formData,
    };

    try {
      const res = await updateTimeOff(id, payload);

      showAlert("Успешно", "success");
      onSuccess();
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      showAlert("Ошибка", "error");
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
          <label className={styles.label}>Сотрудник</label>
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

export default EditTimeOff;
