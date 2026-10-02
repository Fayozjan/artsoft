import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { EmployeeService } from "../api/employees";
import {
  createAssetAssignments,
  editAssetAssignmentById,
  getAssetAssignmentSuggestions,
} from "../api";
import { useAlertStore } from "../stores/alertStore";
import { useScreenStack } from "../context/ScreenStackContext";

import EmployeeSelect from "./EmployeeSelect";
import ui from "./tg/TgUi.module.scss";
import { IconCheck, IconPlus, IconMinus, IconTrash, IconBox } from "./tg/tgIcons";

import styles from "./AssetAssignmentFormScreenTelegram.module.scss";

const today = () => new Date().toISOString().slice(0, 10);
const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

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

// Подсказки под полем — чипы вместо datalist: iOS Safari (WebKit в Telegram) его не рисует.
const SuggestChips = ({ value, options, onPick }) => {
  const filtered = useMemo(() => {
    const query = (value || "").trim().toLowerCase();
    const pool = options || [];
    const list = query
      ? pool.filter((o) => o.toLowerCase().includes(query) && o.toLowerCase() !== query)
      : pool;
    return list.slice(0, 6);
  }, [value, options]);

  if (filtered.length === 0) return null;

  return (
    <div className={styles.suggestRow}>
      {filtered.map((opt) => (
        <button
          key={opt}
          type="button"
          className={styles.suggestChip}
          onClick={() => onPick(opt)}
        >
          {opt}
        </button>
      ))}
    </div>
  );
};

// Экран выдачи / правки имущества в Telegram: на весь экран поверх страницы.
// editAssignment не передан — выдача (можно добавить несколько позиций разом),
// иначе правка одной записи.
const AssetAssignmentFormScreenTelegram = ({ editAssignment, onSaved }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const { popScreen } = useScreenStack();
  const isEdit = !!editAssignment;

  const [employees, setEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState(
    isEdit ? String(editAssignment.employee?.id ?? editAssignment.employee_id) : null,
  );
  const [rows, setRows] = useState(() =>
    isEdit ? [rowFromAssignment(editAssignment)] : [emptyRow()],
  );
  const [suggestions, setSuggestions] = useState({ names: [], conditions: [] });
  const [saving, setSaving] = useState(false);
  const closedRef = useRef(false);

  const close = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    popScreen();
  };

  // у возвращённого/списанного имущества дата выдачи не может быть позже даты возврата
  const returnDateLimit = isEdit ? toDateInput(editAssignment.return_date) : "";

  useEffect(() => {
    EmployeeService.getActive()
      .then((res) => setEmployees(res.data || []))
      .catch(() => setEmployees([]))
      .finally(() => setEmpLoading(false));

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

  const setQuantity = (idx, value) => updateRow(idx, "quantity", Math.max(1, Number(value) || 1));

  const canSave =
    !empLoading &&
    !saving &&
    employeeId &&
    rows.every((r) => r.asset_name.trim() && r.assigned_date && Number(r.quantity) > 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!canSave) return;

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

      if (!res.success) throw new Error(t("error"));

      showAlert(t("success"), "success");
      onSaved?.();
      close();
    } catch (error) {
      console.error("Ошибка при сохранении имущества:", error);
      showAlert(error.response?.data?.error || t("error"), "error");
      setSaving(false);
    }
  };

  return (
    <form className={styles.screen} onSubmit={submit}>
      <div className={styles.topGlass} />

      <header className={styles.head}>
        <h1 className={styles.title}>{isEdit ? t("editAssignment") : t("assignAsset")}</h1>
        <button type="submit" className={styles.saveBtn} disabled={!canSave}>
          <IconCheck />
          {saving ? t("loading") : t("save")}
        </button>
      </header>

      <div className={styles.scroll}>
        {empLoading ? (
          <div className={styles.sections}>
            <div className={styles.card}>
              <span className={styles.skLine} style={{ width: "30%" }} />
              <span className={styles.skLine} style={{ height: 48 }} />
            </div>
          </div>
        ) : (
          <div className={styles.sections}>
            <section className={styles.card}>
              <div className={ui.field}>
                <label className={ui.label}>
                  {t("custodian")} <span className={ui.req}>*</span>
                </label>
                <EmployeeSelect
                  large
                  compact
                  value={employeeId}
                  onChange={setEmployeeId}
                  employees={employees}
                  placeholder={t("selectEmployee")}
                />
              </div>
            </section>

            {rows.map((row, idx) => (
              <section key={idx} className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardIcon}>
                    <IconBox />
                  </span>
                  <h2 className={styles.cardTitle}>
                    {t("assetName")}
                    {rows.length > 1 ? ` #${idx + 1}` : ""}
                  </h2>
                  {!isEdit && (
                    <button
                      type="button"
                      className={styles.removeRowBtn}
                      onClick={() => removeRow(idx)}
                      disabled={rows.length === 1}
                      aria-label={t("delete")}
                    >
                      <IconTrash />
                    </button>
                  )}
                </div>

                <div className={ui.field}>
                  <label className={ui.label}>
                    {t("assetName")} <span className={ui.req}>*</span>
                  </label>
                  <input
                    type="text"
                    className={ui.input}
                    value={row.asset_name}
                    placeholder={t("assetNamePlaceholder")}
                    onChange={(e) => updateRow(idx, "asset_name", e.target.value)}
                    required
                  />
                  <SuggestChips
                    value={row.asset_name}
                    options={suggestions.names}
                    onPick={(val) => updateRow(idx, "asset_name", val)}
                  />
                </div>

                <div className={ui.field}>
                  <label className={ui.label}>{t("assetSpec")}</label>
                  <input
                    type="text"
                    className={ui.input}
                    value={row.asset_spec}
                    placeholder={t("assetSpecPlaceholder")}
                    onChange={(e) => updateRow(idx, "asset_spec", e.target.value)}
                  />
                </div>

                <div className={ui.field}>
                  <label className={ui.label}>{t("assetCondition")}</label>
                  <input
                    type="text"
                    className={ui.input}
                    value={row.asset_condition}
                    placeholder={t("assetConditionPlaceholder")}
                    onChange={(e) => updateRow(idx, "asset_condition", e.target.value)}
                  />
                  <SuggestChips
                    value={row.asset_condition}
                    options={suggestions.conditions}
                    onPick={(val) => updateRow(idx, "asset_condition", val)}
                  />
                </div>

                <div className={styles.row2}>
                  <div className={ui.field}>
                    <label className={ui.label}>{t("quantity")}</label>
                    <div className={styles.stepper}>
                      <button
                        type="button"
                        aria-label="−"
                        disabled={Number(row.quantity) <= 1}
                        onClick={() => setQuantity(idx, Number(row.quantity) - 1)}
                      >
                        <IconMinus />
                      </button>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={row.quantity}
                        onChange={(e) => setQuantity(idx, e.target.value)}
                        aria-label={t("quantity")}
                      />
                      <button
                        type="button"
                        aria-label="+"
                        onClick={() => setQuantity(idx, Number(row.quantity) + 1)}
                      >
                        <IconPlus />
                      </button>
                    </div>
                  </div>

                  <div className={ui.field}>
                    <label className={ui.label}>{t("inventoryNumber")}</label>
                    <input
                      type="text"
                      className={ui.input}
                      value={row.inventory_number}
                      onChange={(e) => updateRow(idx, "inventory_number", e.target.value)}
                    />
                  </div>
                </div>

                <div className={styles.row2}>
                  <div className={ui.field}>
                    <label className={ui.label}>
                      {t("assignedDate")} <span className={ui.req}>*</span>
                    </label>
                    <input
                      type="date"
                      className={ui.input}
                      max={returnDateLimit || undefined}
                      value={row.assigned_date}
                      onChange={(e) => updateRow(idx, "assigned_date", e.target.value)}
                      onFocus={(e) => e.target.showPicker?.()}
                      required
                    />
                  </div>

                  <div className={ui.field}>
                    <label className={ui.label}>{t("expectedReturnDate")}</label>
                    <input
                      type="date"
                      className={ui.input}
                      min={row.assigned_date || undefined}
                      value={row.expected_return_date}
                      onChange={(e) => updateRow(idx, "expected_return_date", e.target.value)}
                      onFocus={(e) => e.target.showPicker?.()}
                    />
                  </div>
                </div>

                <div className={ui.field}>
                  <label className={ui.label}>{t("note")}</label>
                  <input
                    type="text"
                    className={ui.input}
                    value={row.note}
                    onChange={(e) => updateRow(idx, "note", e.target.value)}
                  />
                </div>
              </section>
            ))}

            {!isEdit && (
              <button type="button" className={styles.addRowBtn} onClick={addRow}>
                <IconPlus />
                {t("addAssetRow")}
              </button>
            )}
          </div>
        )}
      </div>
    </form>
  );
};

export default AssetAssignmentFormScreenTelegram;
