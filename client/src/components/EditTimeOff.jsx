import axios from "axios";
import { useState, useEffect, useCallback } from "react";

import { useAlertStore } from "../stores/alertStore";
import { useAuthStore } from "../stores/authStore";

import SelectWithSearch from "./SelectWithSearch";
import Button from "./Button";

import styles from "./AddTimeOff.module.scss";

// Форматируем UTC-строку в Date
function utcToDate(utcString) {
  if (!utcString) return "";

  const date = new Date(utcString);

  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const EditTimeOff = ({ permission_number, cancelButton }) => {
  const [users, setUsers] = useState([]);
  const { showAlert } = useAlertStore();

  const { user_id: user_id } = useAuthStore();

  const [formData, setFormData] = useState({
    user_id: null,
    type: "",
    reason: "",
    date_from: null,
    date_to: null,
    is_company_paid: false,
    credited_hours: 0,
    creator_id: user_id,
  });

  // Получение данных о разрешении
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const { data } = await axios.get(
          `/api/permissions/${permission_number}`
        );
        const perm = data.data;
        if (perm.type === "day") {
          setFormData({
            ...perm,
          });
        } else {
          setFormData({
            ...perm,
            date_from: utcToDate(perm.date_from),
            date_to: utcToDate(perm.date_to),
          });
        }
      } catch (err) {
        console.log(err.message);
      }
    };

    fetchUserInfo();
  }, [permission_number]);

  // === Загрузка списка пользователей ===
  useEffect(() => {
    const fetchData = async () => {
      try {
        const usersRes = await axios.get(`/api/users/get`);
        setUsers(usersRes.data.data);
      } catch (err) {
        console.error("Ошибка загрузки пользователей:", err.message);
      }
    };
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

  // Отправка формы
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.date_from || !formData.date_to) {
      showAlert("Выберите дату", "success");
      return;
    }

    const payload = {
      ...formData,
    };

    try {
      const res = await axios.put(
        `/api/permissions/${permission_number}`,
        payload
      );

      if (res.data.success) {
        showAlert("Выберите дату", "success");
        setTimeout(() => {
          cancelButton();
        }, 1500);
      }
    } catch (error) {
      showAlert("Ошибка", "error");
    }
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.add_permisson}>
        <h1>Изменить разрешение</h1>
        <svg
          className={styles.cancelBtn}
          onClick={() => cancelButton()}
          xmlns="http://www.w3.org/2000/svg"
          width="200"
          height="200"
          viewBox="0 0 42 42"
        >
          <path
            fill="currentColor"
            fill-rule="evenodd"
            d="m21.002 26.588l10.357 10.604c1.039 1.072 1.715 1.083 2.773 0l2.078-2.128c1.018-1.042 1.087-1.726 0-2.839L25.245 21L36.211 9.775c1.027-1.055 1.047-1.767 0-2.84l-2.078-2.127c-1.078-1.104-1.744-1.053-2.773 0L21.002 15.412L10.645 4.809c-1.029-1.053-1.695-1.104-2.773 0L5.794 6.936c-1.048 1.073-1.029 1.785 0 2.84L16.759 21L5.794 32.225c-1.087 1.113-1.029 1.797 0 2.839l2.077 2.128c1.049 1.083 1.725 1.072 2.773 0l10.358-10.604z"
          />
        </svg>
        <form className={styles.employee_form} onSubmit={handleSubmit}>
          <div className={styles.row}>
            <div className={styles.row_item}>
              <label>Тип</label>
              <select name="type" onChange={handleChange} value={formData.type}>
                <option value="hour">Почасовой</option>
                <option value="day">Дневной</option>
              </select>
            </div>
            <div className={styles.row_item}>
              <label> Дата от</label>
              <input
                type={formData.type === "day" ? "date" : "datetime-local"}
                name="date_from"
                value={formData.date_from}
                onChange={handleChange}
                required
              />
            </div>
            <div className={styles.row_item}>
              <label> Дата до</label>
              <input
                type={formData.type === "day" ? "date" : "datetime-local"}
                name="date_to"
                value={formData.date_to}
                onChange={handleChange}
                required
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
              <label>Сотрудник</label>
              <SelectWithSearch
                options={users || []}
                data="user"
                placeholder="Выберите сотрудника"
                setFormData={setFormData}
                required="required"
                defaultValue={formData.user_id}
              />
            </div>
            <div className={styles.row_item}>
              <label>За счет компании</label>
              <select
                name="is_company_paid"
                onChange={handleChange}
                value={formData.is_company_paid}
              >
                <option value="false">Нет</option>
                <option value="true">Да</option>
              </select>
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
          <div className={styles.buttons}>
            <Button text="Сохранить" type="submit" />
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditTimeOff;
