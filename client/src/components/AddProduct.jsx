import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import {
  addProduct,
  getActiveProductCategories,
  getActiveUnits,
  getCategoryAttributes,
  getActiveAttributes,
} from "../api";

import Button from "./Button";

import styles from "./StockForm.module.scss";

const AddProduct = ({ handleClose, onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [allAttributes, setAllAttributes] = useState([]);
  const [categoryAttributes, setCategoryAttributes] = useState([]);
  const [selectedAttributeIds, setSelectedAttributeIds] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    category_id: "",
    unit_id: "",
    sku: "",
    barcode: "",
    description: "",
    min_stock: "",
  });

  const { showAlert } = useAlertStore();
  const { t } = useTranslation();

  useEffect(() => {
    getActiveProductCategories().then((res) => setCategories(res.data || [])).catch(() => setCategories([]));
    getActiveUnits().then((res) => setUnits(res.data || [])).catch(() => setUnits([]));
    getActiveAttributes().then((res) => setAllAttributes(res.data || [])).catch(() => setAllAttributes([]));
  }, []);

  // Смена категории подставляет её характеристики в выбор (обязательные —
  // зафиксированы), но ничего у товара не отжимает обратно.
  useEffect(() => {
    if (!formData.category_id) {
      setCategoryAttributes([]);
      return;
    }

    getCategoryAttributes({ category_id: formData.category_id })
      .then((res) => {
        const list = res.data || [];
        setCategoryAttributes(list);
        setSelectedAttributeIds((prev) => [...new Set([...prev, ...list.map((ca) => ca.attribute_id)])]);
      })
      .catch(() => setCategoryAttributes([]));
  }, [formData.category_id]);

  const isAttributeLocked = (attributeId) =>
    categoryAttributes.some((ca) => ca.attribute_id === attributeId && ca.required);

  const toggleAttribute = (attributeId) => {
    if (isAttributeLocked(attributeId)) return;
    setSelectedAttributeIds((prev) =>
      prev.includes(attributeId) ? prev.filter((id) => id !== attributeId) : [...prev, attributeId],
    );
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await addProduct({ ...formData, attribute_ids: selectedAttributeIds });

      if (res.success) {
        showAlert(t("success"), "success");
        onSuccess();
        setTimeout(handleClose, 1500);
      } else {
        showAlert(t("error"), "error");
      }
    } catch (error) {
      console.error("Ошибка при добавлении товара:", error.response?.data || error.message);
      showAlert(error.response?.data?.error || t("error"), "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("addProduct")}</h2>
        <Button text={t("save")} type="submit" disabled={isLoading} />
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("productName")}</label>
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
          <label>{t("productCategory")}</label>
          <select name="category_id" value={formData.category_id} onChange={handleChange} disabled={isLoading}>
            <option value="">{t("notSelected")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>{t("unitOfMeasure")}</label>
          <select name="unit_id" value={formData.unit_id} onChange={handleChange} required disabled={isLoading}>
            <option value="">{t("notSelected")}</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.short_name ? ` (${u.short_name})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.row}>
        <div style={{ flex: "1 1 100%" }}>
          <label>{t("attributes")}</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 18px" }}>
            {allAttributes.map((a) => (
              <label
                key={a.id}
                style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400, marginBottom: 0 }}
              >
                <input
                  type="checkbox"
                  checked={selectedAttributeIds.includes(a.id)}
                  onChange={() => toggleAttribute(a.id)}
                  disabled={isLoading || isAttributeLocked(a.id)}
                />
                {a.name}
              </label>
            ))}
            {allAttributes.length === 0 && <div>{t("noData")}</div>}
          </div>
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("sku")}</label>
          <input type="text" name="sku" value={formData.sku} onChange={handleChange} disabled={isLoading} />
        </div>
        <div>
          <label>{t("barcode")}</label>
          <input type="text" name="barcode" value={formData.barcode} onChange={handleChange} disabled={isLoading} />
        </div>
        <div>
          <label>{t("minStock")}</label>
          <input
            type="number"
            name="min_stock"
            value={formData.min_stock}
            onChange={handleChange}
            min="0"
            disabled={isLoading}
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("description")}</label>
          <textarea name="description" value={formData.description} onChange={handleChange} disabled={isLoading} />
        </div>
      </div>
    </form>
  );
};

export default AddProduct;
