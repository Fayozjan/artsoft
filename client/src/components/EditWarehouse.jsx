import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { getStockLocationById, editStockLocationById, getActiveBranches } from "../api";

import Button from "./Button";

import styles from "./StockForm.module.scss";

// Склад = stock_locations с type="internal" жёстко зашитым (не выбор пользователя).
// Родителя тоже не даём менять — остаётся тем, с чем склад был создан
// (singleton "Физические склады" для всех новых).
const EditWarehouse = ({ id, handleClose, onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [branches, setBranches] = useState([]);
  const { showAlert } = useAlertStore();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: "",
    parent_id: "",
    branch_id: "",
    code: "",
    note: "",
    status: "true",
  });

  useEffect(() => {
    getActiveBranches().then((res) => setBranches(res.data || [])).catch(() => setBranches([]));

    const fetchData = async () => {
      try {
        const res = await getStockLocationById(id);
        if (res.success) {
          setFormData({
            name: res.data.name || "",
            parent_id: res.data.parent_id ?? "",
            branch_id: res.data.branch_id ?? "",
            code: res.data.code || "",
            note: res.data.note || "",
            status: String(res.data.status),
          });
        }
      } catch (error) {
        console.error("Ошибка при загрузке склада:", error.message);
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
      const res = await editStockLocationById(id, { ...formData, type: "internal" });
      if (res.success) {
        showAlert(t("success"), "success");
        onSuccess();
        setTimeout(handleClose, 1500);
      } else {
        showAlert(t("error"), "error");
      }
    } catch (error) {
      console.error("Ошибка при обновлении склада:", error.response?.data || error.message);
      showAlert(error.response?.data?.error || t("error"), "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("editWarehouse")}</h2>
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
          <select name="branch_id" value={formData.branch_id ?? ""} onChange={handleChange} disabled={isLoading}>
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
        <div>
          <label>{t("status")}</label>
          <select name="status" value={formData.status} onChange={handleChange} disabled={isLoading}>
            <option value="true">{t("true")}</option>
            <option value="false">{t("false")}</option>
          </select>
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

export default EditWarehouse;
