import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { returnAssetAssignment } from "../api";
import { useAlertStore } from "../stores/alertStore";
import styles from "./AssignAssetModal.module.scss";

const today = () => new Date().toISOString().slice(0, 10);

const IconClose = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// Оформление возврата или списания имущества
const ReturnAssetModal = ({ assignment, onClose, onSaved }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const [state, setState] = useState("returned");
  const [returnDate, setReturnDate] = useState(today());
  const [returnCondition, setReturnCondition] = useState(
    assignment?.asset_condition || "",
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!returnDate) {
      showAlert(t("error"), "error");
      return;
    }

    setSaving(true);
    try {
      const res = await returnAssetAssignment(assignment.id, {
        state,
        return_date: returnDate,
        return_condition: returnCondition.trim() || null,
      });

      if (res.success) {
        showAlert(t("success"), "success");
        onSaved?.(res.data);
        onClose();
      } else {
        showAlert(t("error"), "error");
      }
    } catch (error) {
      console.error("Ошибка при возврате имущества:", error);
      showAlert(error.response?.data?.error || t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.modal} style={{ width: "min(460px, 96vw)", height: "auto" }}>
        <div className={styles.header}>
          <span className={styles.title}>{t("returnAsset")}</span>
          <button className={styles.closeBtn} onClick={onClose}>
            <IconClose />
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.assetCard}>
            <span className={styles.customFieldsTitle}>{assignment?.asset_name}</span>
            {assignment?.asset_spec && (
              <span className={styles.dash}>{assignment.asset_spec}</span>
            )}
          </div>

          <div className={styles.field}>
            <label>{t("state")}</label>
            <select
              className={styles.input}
              value={state}
              onChange={(e) => setState(e.target.value)}
            >
              <option value="returned">{t("stateReturned")}</option>
              <option value="scrapped">{t("stateScrapped")}</option>
            </select>
          </div>

          <div className={styles.field}>
            <label>
              {t("returnDate")} <span className={styles.req}>*</span>
            </label>
            <input
              type="date"
              className={styles.input}
              min={
                assignment?.assigned_date
                  ? new Date(assignment.assigned_date).toISOString().slice(0, 10)
                  : undefined
              }
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label>{t("returnCondition")}</label>
            <input
              type="text"
              className={styles.input}
              value={returnCondition}
              placeholder={t("assetConditionPlaceholder")}
              onChange={(e) => setReturnCondition(e.target.value)}
            />
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            {t("cancel")}
          </button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? "…" : t("save")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ReturnAssetModal;
