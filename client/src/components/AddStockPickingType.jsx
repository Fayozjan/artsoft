import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { addStockPickingType, editStockPickingTypeById, getStockPickingTypeById, getActiveStockLocations } from "../api";

import Button from "./Button";
import Loading from "./Loading";
import { Icons } from "../icons/icons";
import styles from "./AddStockPickingType.module.scss";

const CODES = ["incoming", "outgoing", "internal"];

const EMPTY_FORM = {
  name: "",
  code: "incoming",
  sequence_prefix: "",
  default_location_src_id: "",
  default_location_dest_id: "",
  status: "true",
};

// Тип документа — отдельная страница (?type=new / ?type=ID), как "Производство
// / Типы операций" (см. OperationsPage + AddOperationType) — на всю ширину,
// без модалки.
const AddStockPickingType = ({ id, onClose, onSuccess }) => {
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);

  const { showAlert } = useAlertStore();
  const { t } = useTranslation();

  useEffect(() => {
    getActiveStockLocations().then((res) => setLocations(res.data || [])).catch(() => setLocations([]));
  }, []);

  const load = useCallback(async () => {
    if (!isEdit) return;
    setLoading(true);
    try {
      const res = await getStockPickingTypeById(id);
      if (res.success) {
        setForm({
          name: res.data.name || "",
          code: res.data.code || "incoming",
          sequence_prefix: res.data.sequence_prefix || "",
          default_location_src_id: res.data.default_location_src_id ?? "",
          default_location_dest_id: res.data.default_location_dest_id ?? "",
          status: String(res.data.status),
        });
      }
    } catch (error) {
      console.error("Ошибка при загрузке типа документа:", error.message);
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
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = isEdit ? await editStockPickingTypeById(id, form) : await addStockPickingType(form);

      if (res.success) {
        showAlert(t("success"), "success");
        onSuccess();
      } else {
        showAlert(t("error"), "error");
      }
    } catch (error) {
      console.error("Ошибка при сохранении типа документа:", error.response?.data || error.message);
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
          <span className={styles.eyebrow}>{t("pickingType")}</span>
          <h2>{isEdit ? form.name || t("editStockPickingType") : t("addStockPickingType")}</h2>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.grid}>
          <div className={styles.fullRow}>
            <label>{t("name")}</label>
            <input type="text" name="name" value={form.name} onChange={handleChange} required />
          </div>

          <div>
            <label>{t("pickingTypeCode")}</label>
            <select name="code" value={form.code} onChange={handleChange}>
              {CODES.map((code) => (
                <option key={code} value={code}>
                  {t(`pickingTypeCode_${code}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>{t("pickingTypePrefix")}</label>
            <input
              type="text"
              name="sequence_prefix"
              value={form.sequence_prefix}
              onChange={handleChange}
              placeholder="REC-SUP"
              required
            />
          </div>

          <div>
            <label>{t("pickingTypeDefaultSrc")}</label>
            <select name="default_location_src_id" value={form.default_location_src_id} onChange={handleChange}>
              <option value="">{t("notSelected")}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.complete_name || l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>{t("pickingTypeDefaultDest")}</label>
            <select name="default_location_dest_id" value={form.default_location_dest_id} onChange={handleChange}>
              <option value="">{t("notSelected")}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.complete_name || l.name}
                </option>
              ))}
            </select>
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

export default AddStockPickingType;
