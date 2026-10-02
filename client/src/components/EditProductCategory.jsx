import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import {
  getProductCategoryById,
  editProductCategoryById,
  getActiveProductCategories,
  getActiveAttributes,
  getCategoryAttributes,
  addCategoryAttribute,
  editCategoryAttributeById,
  deleteCategoryAttributeById,
} from "../api";

import Button from "./Button";

import styles from "./StockForm.module.scss";
import catStyles from "./EditProductCategory.module.scss";

const EditProductCategory = ({ id, handleClose, onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [allAttributes, setAllAttributes] = useState([]);
  const [linkedAttributes, setLinkedAttributes] = useState([]);
  const [attrSelections, setAttrSelections] = useState({});
  const { showAlert } = useAlertStore();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: "",
    parent_id: "",
    status: "true",
  });

  useEffect(() => {
    getActiveProductCategories()
      .then((res) => setCategories((res.data || []).filter((c) => c.id !== Number(id))))
      .catch(() => setCategories([]));

    getActiveAttributes()
      .then((res) => setAllAttributes(res.data || []))
      .catch(() => setAllAttributes([]));

    getCategoryAttributes({ category_id: id })
      .then((res) => {
        const linked = res.data || [];
        setLinkedAttributes(linked);
        const sel = {};
        linked.forEach((la) => {
          sel[la.attribute_id] = { checked: true, required: la.required };
        });
        setAttrSelections(sel);
      })
      .catch(() => setLinkedAttributes([]));

    const fetchData = async () => {
      try {
        const res = await getProductCategoryById(id);
        if (res.success) {
          setFormData({
            name: res.data.name || "",
            parent_id: res.data.parent_id ?? "",
            status: String(res.data.status),
          });
        }
      } catch (error) {
        console.error("Ошибка при загрузке категории:", error.message);
        showAlert(t("error"), "error");
      }
    };

    fetchData();
  }, [id]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleAttribute = (attributeId) => {
    setAttrSelections((prev) => {
      const cur = prev[attributeId] || { checked: false, required: false };
      return { ...prev, [attributeId]: { ...cur, checked: !cur.checked } };
    });
  };

  const toggleRequired = (attributeId) => {
    setAttrSelections((prev) => {
      const cur = prev[attributeId] || { checked: false, required: false };
      return { ...prev, [attributeId]: { ...cur, required: !cur.required } };
    });
  };

  const syncAttributes = async () => {
    const ops = [];
    for (const attr of allAttributes) {
      const sel = attrSelections[attr.id] || { checked: false, required: false };
      const existing = linkedAttributes.find((la) => la.attribute_id === attr.id);
      if (sel.checked && !existing) {
        ops.push(addCategoryAttribute({ category_id: Number(id), attribute_id: attr.id, required: sel.required }));
      } else if (sel.checked && existing && existing.required !== sel.required) {
        ops.push(editCategoryAttributeById(existing.id, { required: sel.required }));
      } else if (!sel.checked && existing) {
        ops.push(deleteCategoryAttributeById(existing.id));
      }
    }
    await Promise.all(ops);
  };

  const selectedCount = Object.values(attrSelections).filter((s) => s.checked).length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await editProductCategoryById(id, formData);
      if (res.success) {
        await syncAttributes();
        showAlert(t("success"), "success");
        onSuccess();
        setTimeout(handleClose, 1500);
      } else {
        showAlert(t("error"), "error");
      }
    } catch (error) {
      console.error("Ошибка при обновлении категории:", error.response?.data || error.message);
      showAlert(error.response?.data?.error || t("error"), "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>{t("editProductCategory")}</h2>
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
          <label>{t("parentCategory")}</label>
          <select name="parent_id" value={formData.parent_id ?? ""} onChange={handleChange} disabled={isLoading}>
            <option value="">{t("notSelected")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>{t("status")}</label>
          <select name="status" value={formData.status} onChange={handleChange} disabled={isLoading}>
            <option value="true">{t("true")}</option>
            <option value="false">{t("false")}</option>
          </select>
        </div>
      </div>

      {allAttributes.length > 0 && (
        <div className={styles.row}>
          <div>
            <div className={catStyles.attributesBox}>
              <div className={catStyles.attributesHeader}>
                <span className={catStyles.attributesLabel}>{t("categoryAttributes")}</span>
                {selectedCount > 0 && (
                  <span className={catStyles.attributesCount}>{selectedCount}</span>
                )}
              </div>
              <div className={catStyles.attributesList}>
                {allAttributes.map((attr) => {
                  const sel = attrSelections[attr.id] || { checked: false, required: false };
                  return (
                    <div key={attr.id} className={catStyles.attributeRow}>
                      <input
                        type="checkbox"
                        className={catStyles.attributeCheckbox}
                        checked={sel.checked}
                        onChange={() => toggleAttribute(attr.id)}
                        disabled={isLoading}
                      />
                      <span className={catStyles.attributeName}>{attr.name}</span>
                      <label
                        className={`${catStyles.requiredToggle} ${!sel.checked ? catStyles.requiredToggleDisabled : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={sel.required}
                          onChange={() => toggleRequired(attr.id)}
                          disabled={isLoading || !sel.checked}
                        />
                        {t("required")}
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </form>
  );
};

export default EditProductCategory;
