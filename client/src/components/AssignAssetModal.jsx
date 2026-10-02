import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { EmployeeService } from "../api/employees";
import {
  createAssetAssignments,
  editAssetAssignmentById,
  getAssetAssignmentSuggestions,
} from "../api";
import { useAlertStore } from "../stores/alertStore";
import EmployeeSelect from "./EmployeeSelect";
import SuggestInput from "./SuggestInput";
import styles from "./AssignAssetModal.module.scss";

const today = () => new Date().toISOString().slice(0, 10);

const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

const IconClose = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14H6L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4h6v2" />
  </svg>
);

const emptyRow = () => ({
  asset_name: "",
  asset_spec: "",
  asset_condition: "",
  quantity: 1,
  inventory_number: "",
  assigned_date: today(),
  expected_return_date: "",
  note: "",
  custom_fields: [],
});

const rowFromAssignment = (a) => ({
  asset_name: a.asset_name || "",
  asset_spec: a.asset_spec || "",
  asset_condition: a.asset_condition || "",
  quantity: a.quantity ?? 1,
  inventory_number: a.inventory_number || "",
  assigned_date: toDateInput(a.assigned_date) || today(),
  expected_return_date: toDateInput(a.expected_return_date),
  note: a.note || "",
  custom_fields: Array.isArray(a.custom_fields) ? a.custom_fields : [],
});

// editAssignment — существующая запись для режима редактирования, иначе выдача
const AssignAssetModal = ({ onClose, onSaved, editAssignment }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const isEdit = !!editAssignment;

  const [employees, setEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState(
    isEdit ? String(editAssignment.employee?.id ?? editAssignment.employee_id) : null,
  );
  const [rows, setRows] = useState(() =>
    isEdit ? [rowFromAssignment(editAssignment)] : [emptyRow()],
  );
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState({ names: [], conditions: [] });

  // у возвращённого/списанного имущества выдача не может быть позже возврата
  const returnDateLimit = isEdit ? toDateInput(editAssignment.return_date) : "";

  useEffect(() => {
    EmployeeService.getActive()
      .then((res) => setEmployees(res.data || []))
      .catch(() => setEmployees([]))
      .finally(() => setEmpLoading(false));
  }, []);

  // Ранее введённые названия и состояния — подсказки в input через datalist
  useEffect(() => {
    getAssetAssignmentSuggestions()
      .then((res) => {
        if (res.success) {
          setSuggestions({
            names: res.data?.names || [],
            conditions: res.data?.conditions || [],
          });
        }
      })
      .catch(() => setSuggestions({ names: [], conditions: [] }));
  }, []);

  const updateRow = (idx, field, val) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (idx) => setRows((prev) => prev.filter((_, i) => i !== idx));

  // Произвольные доп. поля внутри позиции. Кнопка "+ поле" пока скрыта в UI —
  // хелперы оставлены для повторного включения; уже сохранённые поля редактируются.
  // eslint-disable-next-line no-unused-vars
  const addField = (idx) =>
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, custom_fields: [...r.custom_fields, { label: "", value: "" }] } : r,
      ),
    );

  const updateField = (idx, fieldIdx, key, val) =>
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx
          ? {
              ...r,
              custom_fields: r.custom_fields.map((f, j) =>
                j === fieldIdx ? { ...f, [key]: val } : f,
              ),
            }
          : r,
      ),
    );

  const removeField = (idx, fieldIdx) =>
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx
          ? { ...r, custom_fields: r.custom_fields.filter((_, j) => j !== fieldIdx) }
          : r,
      ),
    );

  const handleSave = async () => {
    const valid =
      employeeId &&
      rows.every((r) => r.asset_name.trim() && r.assigned_date && Number(r.quantity) > 0);

    if (!valid) {
      showAlert(t("error"), "error");
      return;
    }

    if (returnDateLimit && rows.some((r) => r.assigned_date > returnDateLimit)) {
      showAlert(t("assignedDateAfterReturn"), "error");
      return;
    }

    const toPayload = (r) => ({
      asset_name: r.asset_name.trim(),
      asset_spec: r.asset_spec.trim() || null,
      asset_condition: r.asset_condition.trim() || null,
      quantity: Number(r.quantity),
      inventory_number: r.inventory_number.trim() || null,
      assigned_date: r.assigned_date,
      expected_return_date: r.expected_return_date || null,
      note: r.note.trim() || null,
      custom_fields: r.custom_fields.filter((f) => f.label.trim() || f.value.trim()),
    });

    setSaving(true);
    try {
      const res = isEdit
        ? await editAssetAssignmentById(editAssignment.id, {
            employee_id: Number(employeeId),
            ...toPayload(rows[0]),
          })
        : await createAssetAssignments({
            employee_id: Number(employeeId),
            items: rows.map(toPayload),
          });

      if (res.success) {
        showAlert(t("success"), "success");
        onSaved?.(res.data);
        onClose();
      } else {
        showAlert(t("error"), "error");
      }
    } catch (error) {
      console.error("Ошибка при сохранении имущества:", error);
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
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>
            {isEdit ? t("editAssignment") : t("assignAsset")}
          </span>
          <button className={styles.closeBtn} onClick={onClose}>
            <IconClose />
          </button>
        </div>

        <div className={styles.body}>
          {empLoading ? (
            <div className={styles.loadingMsg}>{t("loading")}</div>
          ) : (
            <>
              <div className={styles.custodianRow}>
                <label className={styles.custodianLabel}>
                  {t("custodian")} <span className={styles.req}>*</span>
                </label>
                <div className={styles.custodianField}>
                  <EmployeeSelect
                    value={employeeId}
                    onChange={setEmployeeId}
                    employees={employees}
                    placeholder={t("selectEmployee")}
                  />
                </div>
              </div>

              {rows.map((row, idx) => (
                <div key={idx} className={styles.assetCard}>
                  <div className={styles.mainRow}>
                    <div className={styles.field} style={{ flex: "1.6 1 0" }}>
                      <label>
                        {t("assetName")} <span className={styles.req}>*</span>
                      </label>
                      <SuggestInput
                        className={styles.input}
                        value={row.asset_name}
                        options={suggestions.names}
                        placeholder={t("assetNamePlaceholder")}
                        onChange={(val) => updateRow(idx, "asset_name", val)}
                      />
                    </div>

                    <div className={styles.field} style={{ flex: "1.6 1 0" }}>
                      <label>{t("assetSpec")}</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={row.asset_spec}
                        placeholder={t("assetSpecPlaceholder")}
                        onChange={(e) => updateRow(idx, "asset_spec", e.target.value)}
                      />
                    </div>

                    <div className={styles.field} style={{ flex: "1 1 0" }}>
                      <label>{t("assetCondition")}</label>
                      <SuggestInput
                        className={styles.input}
                        value={row.asset_condition}
                        options={suggestions.conditions}
                        placeholder={t("assetConditionPlaceholder")}
                        onChange={(val) => updateRow(idx, "asset_condition", val)}
                      />
                    </div>

                    <div className={styles.field} style={{ flex: "0 0 80px" }}>
                      <label>{t("quantity")}</label>
                      <input
                        type="number"
                        min="1"
                        className={styles.input}
                        value={row.quantity}
                        onChange={(e) => updateRow(idx, "quantity", e.target.value)}
                      />
                    </div>

                    <div className={styles.field} style={{ flex: "0 0 160px" }}>
                      <label>
                        {t("assignedDate")} <span className={styles.req}>*</span>
                      </label>
                      <input
                        type="date"
                        className={styles.input}
                        max={returnDateLimit || undefined}
                        value={row.assigned_date}
                        onChange={(e) => updateRow(idx, "assigned_date", e.target.value)}
                      />
                    </div>

                    {!isEdit && (
                      <button
                        className={styles.removeRow}
                        onClick={() => removeRow(idx)}
                        disabled={rows.length === 1}
                        title={t("delete")}
                      >
                        <IconTrash />
                      </button>
                    )}
                  </div>

                  <div className={styles.mainRow}>
                    <div className={styles.field} style={{ flex: "1 1 0" }}>
                      <label>{t("note")}</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={row.note}
                        onChange={(e) => updateRow(idx, "note", e.target.value)}
                      />
                    </div>

                    {!isEdit && <span className={styles.removeRowSpacer} />}
                  </div>

                  {row.custom_fields.length > 0 && (
                    <div className={styles.customFields}>
                      <span className={styles.customFieldsTitle}>{t("customFields")}</span>
                      {row.custom_fields.map((field, fieldIdx) => (
                        <div key={fieldIdx} className={styles.customFieldRow}>
                          <input
                            type="text"
                            className={styles.input}
                            value={field.label}
                            placeholder={t("fieldLabel")}
                            onChange={(e) =>
                              updateField(idx, fieldIdx, "label", e.target.value)
                            }
                          />
                          <span className={styles.dash}>—</span>
                          <input
                            type="text"
                            className={styles.input}
                            value={field.value}
                            placeholder={t("fieldValue")}
                            onChange={(e) =>
                              updateField(idx, fieldIdx, "value", e.target.value)
                            }
                          />
                          <button
                            className={styles.removeRow}
                            onClick={() => removeField(idx, fieldIdx)}
                            title={t("delete")}
                          >
                            <IconTrash />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {!isEdit && (
                <button className={styles.addRowBtn} onClick={addRow}>
                  <IconPlus /> {t("addAssetRow")}
                </button>
              )}
            </>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={saving || empLoading}
          >
            {saving ? "…" : isEdit ? t("save") : t("assignBtn")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AssignAssetModal;
