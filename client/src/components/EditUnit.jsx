import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { getUnitById, editUnitById } from "../api";

import Button from "./Button";

import styles from "./StockForm.module.scss";

const EditUnit = ({ id, handleClose, onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { showAlert } = useAlertStore();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: "",
    short_name: "",
    status: "true",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getUnitById(id);
        if (res.success) {
          setFormData({
            name: res.data.name || "",
            short_name: res.data.short_name || "",
            status: String(res.data.status),
          });
        }
      } catch (error) {
        console.error("Ошибка при загрузке единицы измерения:", error.message);
        showAlert(t("error"), "error");
      }
    };

    fetchData();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await editUnitById(id, formData);
      if (res.success) {
        showAlert(t("success"), "success");
        onSuccess();
        setTimeout(handleClose, 1500);
      } else {
        showAlert(t("error"), "error");
      }
    } catch (error) {
      console.error("Ошибка при обновлении единицы измерения:", error.response?.data || error.message);
      showAlert(error.response?.data?.error || t("error"), "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("editUnit")}</h2>
        <Button text={t("save")} type="submit" disabled={isLoading} />
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
            disabled={isLoading}
          />
        </div>
        <div>
          <label>{t("shortName")}</label>
          <input
            type="text"
            name="short_name"
            value={formData.short_name}
            onChange={handleChange}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("status")}</label>
          <select name="status" value={formData.status} onChange={handleChange} disabled={isLoading}>
            <option value="true">{t("true")}</option>
            <option value="false">{t("false")}</option>
          </select>
        </div>
      </div>
    </form>
  );
};

export default EditUnit;
