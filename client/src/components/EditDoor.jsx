import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAuthStore } from "../stores/authStore";
import { useAlertStore } from "../stores/alertStore";

import { getDoor, editDoor } from "../api";

import Button from "./Button";

import styles from "./AddDoor.module.scss";

const EditDoors = ({ id, handleClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    status: "",
  });
  const userSettings = useAuthStore((state) => state.userSettings);
  const { i18n, t } = useTranslation();
  const { showAlert } = useAlertStore();

  useEffect(() => {
    if (userSettings?.language) {
      i18n.changeLanguage(userSettings.language);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getDoor(id);
        if (res.success) {
          setFormData(res.data);
        } else {
          console.error("Ошибка при получении данных двери");
        }
      } catch (error) {
        console.error("Ошибка при загрузке данных:", error.message);
        showAlert(t("error"), "error");
        setTimeout(handleClose, 1500);
      }
    };

    fetchData();
  }, []);

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
      const res = await editDoor(id, formData);

      if (res.success) {
        showAlert(t("success"), "success");
        onSuccess();
        setTimeout(handleClose, 1000);
      }
    } catch (error) {
      console.error(
        "Ошибка при отправке данных:",
        error.response ? error.response.data : error.message
      );
      showAlert(t("error"), "error");
    }
  };

  return (
    <form className={styles.addDoor} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("editDoor")}</h2>
        <Button text={t("save")} type={"submit"} />
      </div>

      <div className={styles.row}>
        <div>
          <label for="name">Название</label>
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
          <label>Статус</label>
          <select
            name="status"
            value={formData?.status}
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

export default EditDoors;
