import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { addHoliday } from "../api";

import Button from "./Button";

import styles from "./AddHoliday.module.scss";
import Loading from "./Loading";

const AddHoliday = ({ handleClose, onSuccess }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const { showAlert } = useAlertStore();
  const [formData, setFormData] = useState({
    name: "",
    date_to: null,
    date_from: null,
  });

  // Устанавливаем даты по умолчанию (сегодняшний день)
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setFormData((prevData) => ({
      ...prevData,
      date_to: today,
      date_from: today,
    }));
  }, []);

  // Обработчик изменения формы
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await addHoliday(formData);

      if (res.success) {
        showAlert(t("success"), "success");
        onSuccess();
        setTimeout(handleClose, 1500);
      } else {
        showAlert(t("error"), "error");
      }
    } catch (error) {
      showAlert(t("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={styles.addHoliday} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("addHoliday")}</h2>
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
          <label>{t("dateFrom")}</label>
          <input
            type="date"
            name="date_from"
            value={formData.date_from}
            onChange={handleChange}
            onFocus={(e) => e.target.showPicker?.()}
            required
          />
        </div>

        <div>
          <label>{t("dateTo")}</label>
          <input
            type="date"
            name="date_to"
            value={formData.date_to}
            onChange={handleChange}
            onFocus={(e) => e.target.showPicker?.()}
            required
          />
        </div>
      </div>

      {loading && <Loading />}
    </form>
  );
};

export default AddHoliday;
