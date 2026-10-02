import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { addStockLocation, getActiveBranches } from "../api";

import Button from "./Button";

import styles from "./StockForm.module.scss";

// Склад = stock_locations с type="internal" жёстко зашитым (не выбор пользователя).
// parent_id тоже НЕ шлём — резолвится на сервере по коду singleton-корня
// "Физические склады" (см. stockLocations.service.js addStockLocation).
// Так исключён сам класс бага "выбран не тот id локации" — клиенту нечего выбирать.
const AddWarehouse = ({ handleClose, onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [branches, setBranches] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    branch_id: "",
    code: "",
    note: "",
  });

  const { showAlert } = useAlertStore();
  const { t } = useTranslation();

  useEffect(() => {
    getActiveBranches().then((res) => setBranches(res.data || [])).catch(() => setBranches([]));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await addStockLocation({ ...formData, type: "internal" });

      if (res.success) {
        showAlert(t("success"), "success");
        onSuccess();
        setTimeout(handleClose, 1500);
      } else {
        showAlert(t("error"), "error");
      }
    } catch (error) {
      console.error("Ошибка при добавлении склада:", error.response?.data || error.message);
      showAlert(error.response?.data?.error || t("error"), "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("addWarehouse")}</h2>
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
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("branch")}</label>
          <select name="branch_id" value={formData.branch_id} onChange={handleChange} disabled={isLoading}>
            <option value="">{t("notSelected")}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("locationCode")}</label>
          <input type="text" name="code" value={formData.code} onChange={handleChange} disabled={isLoading} />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("note")}</label>
          <textarea name="note" value={formData.note} onChange={handleChange} disabled={isLoading} />
        </div>
      </div>
    </form>
  );
};

export default AddWarehouse;
