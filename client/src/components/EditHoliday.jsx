import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { getHolidayById, updateHolidayById } from "../api";

import Button from "./Button";
import Loading from "./Loading";

import styles from "./AddHoliday.module.scss";

const EditHoliday = ({ id, handleClose, onSuccess }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const { showAlert } = useAlertStore();

  const [formData, setFormData] = useState({
    name: "",
    date_to: null,
    date_from: null,
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getHolidayById(id);

      if (res.success) {
        setFormData(res.data);
      }
    } catch (error) {
      console.log("error", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  // Обработчик изменения формы
  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({ ...prevData, [name]: value }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);

    try {
      const res = await updateHolidayById(id, formData);

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

  return (
    <form className={styles.addHoliday} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("editHoliday")}</h2>
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
          <label>Дата от</label>
          <input
            type="date"
            name="date_from"
            value={formData.date_from}
            onChange={handleChange}
            required
          />
        </div>
        <div className={styles.row_item}>
          <label>Дата до</label>
          <input
            type="date"
            name="date_to"
            value={formData.date_to}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      {loading && <Loading />}
    </form>
  );
};

export default EditHoliday;
