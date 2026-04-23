import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { EmployeeService } from "../api/employees";
import { payrollApi } from "../api/payroll";
import { useAlertStore } from "../stores/alertStore";
import styles from "./GiveAdvanceModal.module.scss";

const today = () => new Date().toISOString().slice(0, 10);

const fmt = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");

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

// ── EmployeeSelect ─────────────────────────────────────────────────────────────
// getActive returns: { id: String, employeeFullName, branchName, departmentName }

const EmployeeSelect = ({ value, onChange, employees, placeholder }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef();
  const triggerRef = useRef();
  const ref = useRef();

  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  useEffect(() => {
    if (open) {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const selected = employees.find((e) => e.id === value);

  const filtered = query.trim()
    ? employees.filter((e) =>
        (e.employeeFullName || "").toLowerCase().includes(query.toLowerCase())
      )
    : employees;

  return (
    <div ref={ref} className={styles.empSelect}>
      <div
        ref={triggerRef}
        className={`${styles.empSelectTrigger} ${open ? styles.empSelectOpen : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        {selected ? (
          <span className={styles.empSelectValue}>{selected.employeeFullName}</span>
        ) : (
          <span className={styles.empSelectPlaceholder}>{placeholder}</span>
        )}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {open && (
        <div
          className={styles.empSelectDropdown}
          style={{ position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 1400 }}
        >
          <input
            ref={inputRef}
            className={styles.empSelectSearch}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по ФИО..."
            onClick={(e) => e.stopPropagation()}
          />
          <div className={styles.empSelectList}>
            {filtered.length > 0 ? filtered.map((emp) => (
              <div
                key={emp.id}
                className={`${styles.empSelectItem} ${emp.id === value ? styles.empSelectItemActive : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onChange(emp.id); setOpen(false); setQuery(""); }}
              >
                <span className={styles.empSelectItemName}>{emp.employeeFullName}</span>
                {(emp.branchName || emp.departmentName) && (
                  <span className={styles.empSelectItemSub}>
                    {[emp.branchName, emp.departmentName].filter(Boolean).join(" / ")}
                  </span>
                )}
              </div>
            )) : (
              <div className={styles.empSelectEmpty}>Нет результатов</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── GiveAdvanceModal ───────────────────────────────────────────────────────────

const emptyRow = () => ({ employee_id: null, amount: "", advance_date: today(), note: "" });

const toDateInput = (d) => {
  if (!d) return today();
  return new Date(d).toISOString().slice(0, 10);
};

// editAdvance: existing advance object for edit mode, null/undefined for create mode
const GiveAdvanceModal = ({ onClose, onSaved, editAdvance }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const isEdit = !!editAdvance;

  const [employees, setEmployees] = useState([]);
  const [empLoading, setEmpLoading] = useState(true);
  const [rows, setRows] = useState(() =>
    isEdit
      ? [{ employee_id: String(editAdvance.employee?.id ?? editAdvance.employee_id), amount: String(editAdvance.amount), advance_date: toDateInput(editAdvance.advance_date), note: editAdvance.note || "" }]
      : [emptyRow()]
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    EmployeeService.getActive()
      .then((res) => setEmployees(res.data || []))
      .catch(() => setEmployees([]))
      .finally(() => setEmpLoading(false));
  }, []);

  const updateRow = (idx, field, val) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (idx) => setRows((prev) => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    const valid = rows.every((r) => r.employee_id && r.amount && Number(r.amount) > 0 && r.advance_date);
    if (!valid) {
      showAlert("Заполните все обязательные поля (сотрудник, сумма, дата)", "error");
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        const r = rows[0];
        const res = await payrollApi.updateAdvance(editAdvance.id, {
          employee_id: Number(r.employee_id),
          amount: Number(r.amount),
          advance_date: r.advance_date,
          note: r.note.trim() || null,
        });
        if (res.success) {
          showAlert(t("advanceUpdated"), "success");
          onSaved?.(res.data);
          onClose();
        } else {
          showAlert(res.message || t("error"), "error");
        }
      } else {
        const advances = rows.map((r) => ({
          employee_id: Number(r.employee_id),
          amount: Number(r.amount),
          advance_date: r.advance_date,
          note: r.note.trim() || null,
        }));
        const res = await payrollApi.createAdvances(advances);
        if (res.success) {
          showAlert(t("saved"), "success");
          onSaved?.();
          onClose();
        } else {
          showAlert(res.message || t("error"), "error");
        }
      }
    } catch {
      showAlert(t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>{isEdit ? t("editAdvanceTitle") : t("giveAdvanceTitle")}</span>
          <button className={styles.closeBtn} onClick={onClose}><IconClose /></button>
        </div>

        <div className={styles.body}>
          {empLoading ? (
            <div className={styles.loadingMsg}>Загрузка сотрудников…</div>
          ) : (
            <>
              <div className={styles.colHeaders}>
                <span style={{ flex: "2 1 0" }}>{t("employee")} *</span>
                <span style={{ flex: "1 1 0" }}>{t("advanceAmount")} *</span>
                <span style={{ flex: "1 1 0" }}>{t("advanceDate")} *</span>
                <span style={{ flex: "1.5 1 0" }}>{t("advanceNote")}</span>
                {!isEdit && <span style={{ width: 32 }}></span>}
              </div>

              {rows.map((row, idx) => (
                <div key={idx} className={styles.row}>
                  <div style={{ flex: "2 1 0", minWidth: 0 }}>
                    <EmployeeSelect
                      value={row.employee_id}
                      onChange={(val) => updateRow(idx, "employee_id", val)}
                      employees={employees}
                      placeholder={t("selectEmployee")}
                    />
                  </div>

                  <div style={{ flex: "1 1 0", minWidth: 0 }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      className={styles.input}
                      value={row.amount !== "" ? fmt(row.amount) : ""}
                      placeholder="0"
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, "");
                        updateRow(idx, "amount", raw);
                      }}
                    />
                  </div>

                  <div style={{ flex: "1 1 0", minWidth: 0 }}>
                    <input
                      type="date"
                      className={styles.input}
                      value={row.advance_date}
                      onChange={(e) => updateRow(idx, "advance_date", e.target.value)}
                    />
                  </div>

                  <div style={{ flex: "1.5 1 0", minWidth: 0 }}>
                    <input
                      type="text"
                      className={styles.input}
                      value={row.note}
                      placeholder={t("advanceNote")}
                      onChange={(e) => updateRow(idx, "note", e.target.value)}
                    />
                  </div>

                  {!isEdit && (
                    <button
                      className={styles.removeRow}
                      onClick={() => removeRow(idx)}
                      disabled={rows.length === 1}
                    >
                      <IconTrash />
                    </button>
                  )}
                </div>
              ))}

              {!isEdit && (
                <button className={styles.addRowBtn} onClick={addRow}>
                  <IconPlus /> {t("addEmployee")}
                </button>
              )}
            </>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>{t("cancel")}</button>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={saving || empLoading}
          >
            {saving ? "…" : isEdit ? t("save") : t("giveBtn")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GiveAdvanceModal;
