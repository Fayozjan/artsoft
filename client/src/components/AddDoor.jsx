import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAuthStore } from "../stores/authStore";
import { useAlertStore } from "../stores/alertStore";

import { addDoor } from "../api";

import Button from "./Button";

import styles from "./AddDoor.module.scss";

const AddDoor = ({ handleClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
  });
  const userSettings = useAuthStore((state) => state.userSettings);
  const { i18n, t } = useTranslation();
  const { showAlert } = useAlertStore();

  useEffect(() => {
    if (userSettings?.language) {
      i18n.changeLanguage(userSettings.language);
    }
  }, [userSettings, i18n]);

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
      const res = await addDoor(formData);

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
        error.response ? error.response.data : error.message
      );
      showAlert(t("error"), "error");
      setTimeout(handleClose, 1500);
    }
  };

  return (
    <form className={styles.addDoor} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("addDoor")}</h2>
        <Button text={t("save")} type={"submit"} />
      </div>

      <div className={styles.row}>
        <div>
          <label for="name">
            Название <span style={{ color: "red" }}>*</span>
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
          />
        </div>
      </div>
    </form>
  );
};

export default AddDoor;
