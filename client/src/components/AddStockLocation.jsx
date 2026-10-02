import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { addStockLocation, getActiveStockLocations, getActiveBranches } from "../api";

import Button from "./Button";

import styles from "./StockForm.module.scss";

const LOCATION_USAGE_OPTIONS = [
  "view",
  "internal",
  "supplier",
  "customer",
  "production",
  "expense",
  "inventory",
  "transit",
];

const AddStockLocation = ({ handleClose, onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [locations, setLocations] = useState([]);
  const [branches, setBranches] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    parent_id: "",
    type: "internal",
    branch_id: "",
    code: "",
    note: "",
    is_scrap: false,
  });

  const { showAlert } = useAlertStore();
  const { t } = useTranslation();

  useEffect(() => {
    getActiveStockLocations().then((res) => setLocations(res.data || [])).catch(() => setLocations([]));
    getActiveBranches().then((res) => setBranches(res.data || [])).catch(() => setBranches([]));
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await addStockLocation(formData);

      if (res.success) {
        showAlert(t("success"), "success");
        onSuccess();
        setTimeout(handleClose, 1500);
      } else {
        showAlert(t("error"), "error");
      }
    } catch (error) {
      console.error("Ошибка при добавлении локации:", error.response?.data || error.message);
      showAlert(error.response?.data?.error || t("error"), "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("addStorageLocation")}</h2>
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
          <label>{t("parentLocation")}</label>
          <select name="parent_id" value={formData.parent_id} onChange={handleChange} disabled={isLoading}>
            <option value="">{t("notSelected")}</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.complete_name || l.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>{t("locationType")}</label>
          <select name="type" value={formData.type} onChange={handleChange} disabled={isLoading}>
            {LOCATION_USAGE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {t(`locationUsage${opt.charAt(0).toUpperCase()}${opt.slice(1)}`)}
              </option>
            ))}
          </select>
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
        <div>
          <label>{t("locationCode")}</label>
          <input type="text" name="code" value={formData.code} onChange={handleChange} disabled={isLoading} />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>
            <input
              type="checkbox"
              name="is_scrap"
              checked={formData.is_scrap}
              onChange={handleChange}
              disabled={isLoading}
              style={{ width: "auto", height: "auto", marginRight: 6 }}
            />
            {t("isScrap")}
          </label>
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

export default AddStockLocation;
