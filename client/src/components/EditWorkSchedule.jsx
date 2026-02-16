import axios from "axios";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import {
  EmployeeService,
  getWorkScheduleById,
  editWorkScheduleById,
} from "../api";

import Button from "./Button";

import styles from "./AddWorkSchedule.module.scss";
import MultiSelectEmployees from "./MultiSelectEmployees";

const EditWorkSchedule = ({ id, handleClose, onSuccess }) => {
  const { showAlert } = useAlertStore();
  const [employees, setEmployees] = useState();
  const [formData, setFormData] = useState({
    name: "",
    shift_type: "",
    shift_start: "",
    shift_end: "",
    break_minutes: 0,
    first_shift_start: "",
    first_shift_end: "",
    first_shift_break_start: "",
    first_shift_break_end: "",
    second_shift_start: "",
    second_shift_end: "",
    third_shift_start: "",
    third_shift_end: "",
    selectedEmployeeIds: [],
    status: "",
  });
  const { t } = useTranslation();

  console.log(formData);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [workScheduleRes, employeeRes] = await Promise.all([
          getWorkScheduleById(id),
          EmployeeService.getActive(),
        ]);

        if (workScheduleRes.success) {
          setFormData(workScheduleRes.data);
        } else {
          console.error("Ошибка при получении данных рабочего графика");
        }

        if (employeeRes.success) {
          setEmployees(employeeRes.data);
        } else {
          console.error("Ошибка при получении списка активных сотрудников");
        }
      } catch (error) {
        console.error("Ошибка при загрузке данных:", error.message);
        showAlert("Ошибка", "error");
        setTimeout(() => handleClose(), 1500);
      }
    };

    fetchData();
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
      const res = await editWorkScheduleById(id, formData);
      if (res.success) {
        showAlert("Успешно", "success");
        onSuccess();
        const timer = setTimeout(() => {
          handleClose();
        }, 1500);

        return () => clearTimeout(timer);
      }
    } catch (error) {
      console.error(
        "Ошибка при обновлении данных:",
        error.response ? error.response.data : error.message,
      );
      showAlert("Ошибка", "error");
    }
  };

  return (
    <form className={styles.addWorkSchedules} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("editWorkSchedule")}</h2>
        <Button text={t("save")} type={"submit"} />
      </div>

      <div className={styles.row}>
        <div>
          <label>Название</label>
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
          <label>Тип</label>
          <select
            name="shift_type"
            value={formData.shift_type}
            onChange={handleChange}
          >
            <option value="normal">Обычный</option>
            <option value="shift">Сменный</option>
            <option value="flexible">Свободный</option>
          </select>
        </div>
      </div>

      {(formData.shift_type === "normal" ||
        formData.shift_type === "flexible") && (
        <div className={styles.row}>
          <div>
            <label>Начало</label>
            <input
              type="time"
              name="shift_start"
              value={formData.shift_start}
              onChange={handleChange}
            />
          </div>

          <div>
            <label>Конец</label>
            <input
              type="time"
              name="shift_end"
              value={formData.shift_end}
              onChange={handleChange}
            />
          </div>
        </div>
      )}

      {formData.shift_type === "shift" &&
        ["first_shift", "second_shift", "third_shift"].map((shift, index) => (
          <div key={shift} className={styles.row}>
            <div>
              <label>{`Начало ${index + 1} смены`}</label>
              <input
                type="time"
                name={`${shift}_start`}
                value={formData[`${shift}_start`] || ""}
                onChange={handleChange}
              />
            </div>

            <div>
              <label>{` Конец ${index + 1} смены`}</label>
              <input
                type="time"
                name={`${shift}_end`}
                value={formData[`${shift}_end`] || ""}
                onChange={handleChange}
              />
            </div>
          </div>
        ))}

      <div className={styles.row}>
        <div>
          <label>Перерыв (минуты)</label>
          <input
            type="number"
            min={0}
            name="break_minutes"
            value={formData.break_minutes}
            onChange={handleChange}
          />
        </div>

        <div>
          <label>Действует с</label>
          <input
            type="date"
            name="valid_from"
            value={formData.valid_from}
            onChange={handleChange}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label className={styles.label}>
            Сотрудники
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
          <label>Статус</label>
          <select
            name="status"
            value={formData.status.toString()}
            onChange={handleChange}
          >
            <option value="true">Включить</option>
            <option value="false">Выключить</option>
          </select>
        </div>
      </div>
    </form>
  );
};

export default EditWorkSchedule;
