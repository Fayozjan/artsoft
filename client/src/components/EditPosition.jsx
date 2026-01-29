import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAuthStore } from "../stores/authStore";
import { useAlertStore } from "../stores/alertStore";

import { getPositionById, editPositionById } from "../api";

import Button from "./Button";

import styles from "./AddPosition.module.scss";

const EditPosition = ({ id, onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { showAlert } = useAlertStore();
  const [formData, setFormData] = useState({
    name: "",
    status: "true",
  });

  const userSettings = useAuthStore((state) => state.userSettings);
  const { i18n, t } = useTranslation();

  useEffect(() => {
    if (userSettings?.language) {
      i18n.changeLanguage(userSettings.language);
    }
  }, [userSettings, i18n]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getPositionById(id);
        if (res.success) {
          setFormData(res.data);
        } else {
          console.error("Ошибка при получении данных должности");
        }
      } catch (error) {
        console.error("Ошибка при загрузке данных:", error.message);
        showAlert(t("error"), "error");
      }
    };

    fetchData();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await editPositionById(id, formData);
      if (res.success) {
        showAlert(t("success"), "success");
        onSuccess();
      } else {
        console.log("Ошибка в ответе сервера:", res.data);
        showAlert(t("error"), "error");
      }
    } catch (error) {
      console.error(
        "Ошибка при обновлении данных:",
        error.response ? error.response.data : error.message
      );
      showAlert(t("error"), "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className={styles.addPosition} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("editPosition")}</h2>
        <Button text={t("save")} type={"submit"} />
      </div>

      <div className={styles.row}>
        <div>
          <label htmlFor="name">{t("name")}</label>
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
          <label htmlFor="status">{t("status")}</label>
          <select
            name="status"
            value={formData?.status}
            onChange={handleChange}
          >
            <option value="true">{t("true")}</option>
            <option value="false">{t("false")}</option>
          </select>
        </div>
      </div>
    </form>
  );
};

export default EditPosition;
