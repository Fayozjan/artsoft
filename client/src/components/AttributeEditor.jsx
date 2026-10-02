import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import {
  getAttributeById,
  editAttributeById,
  getAttributeValues,
  addAttributeValue,
  deleteAttributeValue,
} from "../api";
import { Icons } from "../icons/icons";

import Button from "./Button";

import styles from "./AttributeForm.module.scss";

const AttributeEditor = ({ attributeId, canEdit, onChanged }) => {
  const [formData, setFormData] = useState({ name: "", status: "true" });
  const [values, setValues] = useState([]);
  const [newValue, setNewValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const { showAlert } = useAlertStore();
  const { t } = useTranslation();

  const fetchAttribute = async () => {
    try {
      const res = await getAttributeById(attributeId);
      if (res.success) {
        setFormData({ name: res.data.name || "", status: String(res.data.status) });
      }
    } catch (error) {
      console.error("Ошибка при загрузке характеристики:", error.message);
    }
  };

  const fetchValues = async () => {
    try {
      const res = await getAttributeValues(attributeId);
      setValues(res.data || []);
    } catch (error) {
      console.error("Ошибка при загрузке значений характеристики:", error.message);
    }
  };

  useEffect(() => {
    fetchAttribute();
    fetchValues();
  }, [attributeId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleStatusPick = (status) => {
    if (!canEdit) return;
    setFormData((prev) => ({ ...prev, status }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await editAttributeById(attributeId, formData);
      if (res.success) {
        showAlert(t("success"), "success");
        onChanged?.();
      } else {
        showAlert(t("error"), "error");
      }
    } catch (error) {
      console.error("Ошибка при обновлении характеристики:", error.response?.data || error.message);
      showAlert(error.response?.data?.error || t("error"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddValue = async (e) => {
    e.preventDefault();
    if (!newValue.trim()) return;
    setIsAdding(true);
    try {
      const res = await addAttributeValue(attributeId, newValue.trim());
      if (res.success) {
        setNewValue("");
        fetchValues();
        onChanged?.();
      } else {
        showAlert(t("error"), "error");
      }
    } catch (error) {
      console.error("Ошибка при добавлении значения:", error.response?.data || error.message);
      showAlert(error.response?.data?.error || t("error"), "error");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteValue = async (valueId) => {
    try {
      const res = await deleteAttributeValue(valueId);
      if (res.success) {
        fetchValues();
        onChanged?.();
      } else {
        showAlert(t("error"), "error");
      }
    } catch (error) {
      console.error("Ошибка при удалении значения:", error.response?.data || error.message);
      showAlert(error.response?.data?.error || t("error"), "error");
    }
  };

  return (
    <div className={styles.panel}>
      <form onSubmit={handleSave}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <span className={styles.headerIcon}>{Icons.list}</span>
            <h2>{t("editAttribute")}</h2>
          </div>
          {canEdit && <Button text={t("save")} type="submit" disabled={isSaving} />}
        </div>

        <div className={styles.body}>
          <div className={styles.field}>
            <label>{t("attributeName")}</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              disabled={isSaving || !canEdit}
            />
          </div>

          <div className={styles.field}>
            <label>{t("status")}</label>
            <div className={`${styles.statusToggle} ${!canEdit ? styles.statusToggleDisabled : ""}`}>
              <button
                type="button"
                className={formData.status === "true" ? styles.statusOn : ""}
                onClick={() => handleStatusPick("true")}
                disabled={!canEdit || isSaving}
              >
                <span className={styles.dot} />
                {t("true")}
              </button>
              <button
                type="button"
                className={formData.status === "false" ? styles.statusOff : ""}
                onClick={() => handleStatusPick("false")}
                disabled={!canEdit || isSaving}
              >
                <span className={styles.dot} />
                {t("false")}
              </button>
            </div>
          </div>
        </div>
      </form>

      <div className={styles.divider} />

      <div className={styles.body}>
        <div className={styles.sectionHeader}>
          <h3>{t("attributeValues")}</h3>
          <span className={styles.count}>{values.length}</span>
        </div>

        {values.length > 0 ? (
          <div className={styles.valuesWrap}>
            {values.map((v) => (
              <span key={v.id} className={styles.valueChip}>
                <span>{v.value}</span>
                <button type="button" onClick={() => handleDeleteValue(v.id)} aria-label={t("deleteBtn")}>
                  {Icons.clear}
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className={styles.emptyValues}>{t("noData")}</div>
        )}

        <form onSubmit={handleAddValue} className={styles.addValueRow}>
          <input
            type="text"
            placeholder={t("newValue")}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            disabled={isAdding}
          />
          <Button text={t("add")} type="submit" disabled={isAdding} />
        </form>
      </div>
    </div>
  );
};

export default AttributeEditor;
