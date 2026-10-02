import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { addCurrency, editCurrencyById, getCurrencyById } from "../api";

import Button from "./Button";
import Loading from "./Loading";
import { Icons } from "../icons/icons";
import styles from "./AddCurrency.module.scss";

const EMPTY_FORM = {
  code: "",
  name: "",
  symbol: "",
  is_base: false,
  status: "true",
};

const AddCurrency = ({ id, onClose, onSuccess }) => {
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { showAlert } = useAlertStore();
  const { t } = useTranslation();

  const load = useCallback(async () => {
    if (!isEdit) return;
    setLoading(true);
    try {
      const res = await getCurrencyById(id);
      if (res.success) {
        setForm({
          code: res.data.code || "",
          name: res.data.name || "",
          symbol: res.data.symbol || "",
          is_base: Boolean(res.data.is_base),
          status: String(res.data.status),
        });
      }
    } catch (error) {
      console.error("Ошибка при загрузке валюты:", error.message);
      showAlert(t("error"), "error");
      onClose?.();
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = isEdit ? await editCurrencyById(id, form) : await addCurrency(form);

      if (res.success) {
        showAlert(t("success"), "success");
        onSuccess();
      } else {
        showAlert(t("error"), "error");
      }
    } catch (error) {
      console.error("Ошибка при сохранении валюты:", error.response?.data || error.message);
      showAlert(error.response?.data?.error || t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className={styles.page} onSubmit={handleSubmit}>
      {loading && <Loading />}

      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onClose}>
          {Icons.arrowBack}
          <span>{t("back")}</span>
        </button>
        <div className={styles.headerText}>
          <span className={styles.eyebrow}>{t("currency")}</span>
          <h2>{isEdit ? form.name || t("editCurrency") : t("addCurrency")}</h2>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.grid}>
          <div>
            <label>{t("currencyCode")}</label>
            <input
              type="text"
              name="code"
              value={form.code}
              onChange={handleChange}
              placeholder="USD"
              maxLength={10}
              required
            />
          </div>
          <div>
            <label>{t("currencySymbol")}</label>
            <input type="text" name="symbol" value={form.symbol} onChange={handleChange} placeholder="$" maxLength={10} />
          </div>

          <div className={styles.fullRow}>
            <label>{t("currencyName")}</label>
            <input type="text" name="name" value={form.name} onChange={handleChange} required />
          </div>

          <div className={styles.checkboxRow}>
            <input type="checkbox" name="is_base" id="is_base" checked={form.is_base} onChange={handleChange} />
            <label htmlFor="is_base">{t("currencyIsBase")}</label>
          </div>

          {isEdit && (
            <div>
              <label>{t("status")}</label>
              <select name="status" value={form.status} onChange={handleChange}>
                <option value="true">{t("true")}</option>
                <option value="false">{t("false")}</option>
              </select>
            </div>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.cancelBtn} onClick={onClose}>
          {t("cancel")}
        </button>
        <Button text={t("save")} type="submit" loading={saving} />
      </div>
    </form>
  );
};

export default AddCurrency;
