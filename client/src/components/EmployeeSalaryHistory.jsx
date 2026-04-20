import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

import Loading from "./Loading";
import { salaryHistoryApi } from "../api/salaryHistory";
import styles from "./EmployeeSalaryHistory.module.scss";

const SALARY_TYPES = [
  { value: "monthly", labelKey: "salaryTypeMonthly" },
  { value: "hourly", labelKey: "salaryTypeHourly" },
  { value: "piecework", labelKey: "salaryTypePiecework" },
];

const amountLabelKey = {
  monthly: "salaryAmountMonthly",
  hourly: "salaryAmountHourly",
  piecework: "salaryAmountPiecework",
};

const emptyForm = {
  salary_type: "monthly",
  amount: "",
  date_from: "",
  date_to: "",
  note: "",
};

const EmployeeSalaryHistory = ({ employeeId, handleClose, initialOpenAdd = false, showClose = true }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [showAddForm, setShowAddForm] = useState(initialOpenAdd);
  const [addForm, setAddForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const res = await salaryHistoryApi.getByEmployee(employeeId);
      if (res?.success) setHistory(res.data);
    } catch (e) {
      console.error("Ошибка загрузки истории зарплат", e);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDelete = async (id) => {
    setLoading(true);
    try {
      const res = await salaryHistoryApi.deleteById(id);
      if (res?.success) setHistory((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      console.error("Ошибка удаления", e);
    } finally {
      setDeletingId(null);
      setLoading(false);
    }
  };

  const handleEditStart = (item) => {
    setEditingId(item.id);
    setEditForm({
      salary_type: item.salary_type,
      amount: item.amount,
      date_from: item.date_from?.slice(0, 10) || "",
      date_to: item.date_to?.slice(0, 10) || "",
      note: item.note || "",
    });
  };

  const handleEditSave = async (id) => {
    setSaving(true);
    try {
      const res = await salaryHistoryApi.update(id, editForm);
      if (res?.success) {
        setHistory((prev) =>
          prev.map((i) => (i.id === id ? { ...i, ...editForm } : i))
        );
        setEditingId(null);
      }
    } catch (e) {
      console.error("Ошибка обновления", e);
    } finally {
      setSaving(false);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await salaryHistoryApi.create({
        ...addForm,
        employee_id: employeeId,
      });
      if (res?.success) {
        setAddForm(emptyForm);
        setShowAddForm(false);
        await fetchHistory();
      }
    } catch (e) {
      console.error("Ошибка создания", e);
    } finally {
      setSaving(false);
    }
  };

  const formatAddedBy = (item) => {
    const emp = item.addedBy?.employee;
    if (!emp) return "—";
    return [emp.last_name, emp.first_name, emp.middle_name]
      .filter(Boolean)
      .join(" ");
  };

  const salaryTypeLabel = (type) => {
    const found = SALARY_TYPES.find((s) => s.value === type);
    return found ? t(found.labelKey) : type;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h4 className={styles.title}>{t("salaryHistory")}</h4>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => setShowAddForm((v) => !v)}
          >
            {showAddForm ? "✕" : "+ " + t("add")}
          </button>
          {showClose && (
            <svg
              onClick={handleClose}
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 304 384"
              style={{ cursor: "pointer" }}
            >
              <path
                fill="currentColor"
                d="M299 73L179 192l120 119l-30 30l-120-119L30 341L0 311l119-119L0 73l30-30l119 119L269 43z"
              />
            </svg>
          )}
        </div>
      </div>

      {showAddForm && (
        <form className={styles.addForm} onSubmit={handleAddSubmit}>
          <div className={styles.formRow}>
            <label>{t("salaryType")}</label>
            <div className={styles.radioGroup}>
              {SALARY_TYPES.map((s) => (
                <label key={s.value} className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="salary_type"
                    value={s.value}
                    checked={addForm.salary_type === s.value}
                    onChange={(e) =>
                      setAddForm((p) => ({ ...p, salary_type: e.target.value }))
                    }
                  />
                  {t(s.labelKey)}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.formRow}>
            <label>{t(amountLabelKey[addForm.salary_type])}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={addForm.amount}
              onChange={(e) =>
                setAddForm((p) => ({ ...p, amount: e.target.value }))
              }
            />
          </div>

          <div className={styles.formRowDates}>
            <div>
              <label>{t("dateFrom")}</label>
              <input
                type="date"
                required
                value={addForm.date_from}
                onChange={(e) =>
                  setAddForm((p) => ({ ...p, date_from: e.target.value }))
                }
              />
            </div>
            <div>
              <label>{t("dateTo")}</label>
              <input
                type="date"
                value={addForm.date_to}
                onChange={(e) =>
                  setAddForm((p) => ({ ...p, date_to: e.target.value }))
                }
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <label>{t("note")}</label>
            <input
              type="text"
              value={addForm.note}
              onChange={(e) =>
                setAddForm((p) => ({ ...p, note: e.target.value }))
              }
            />
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? "..." : t("save")}
            </button>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => setShowAddForm(false)}
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      )}

      <div className={styles.timelineWrapper}>
        {!loading && history.length === 0 && (
          <div className={styles.empty}>{t("salaryHistoryEmpty")}</div>
        )}

        {history.map((item, index) => (
          <div key={item.id} className={styles.timeline_item}>
            <div className={styles.timeline_date}>
              <div className={styles.date_start}>
                {item.date_from
                  ? format(new Date(item.date_from), "dd.MM.yyyy")
                  : "—"}
              </div>
              <div className={styles.date_sep}>↓</div>
              <div className={styles.date_end}>
                {item.date_to
                  ? format(new Date(item.date_to), "dd.MM.yyyy")
                  : t("toPresent")}
              </div>
            </div>

            <div className={styles.timeline_path}>
              <div className={styles.dot} />
              {index !== history.length - 1 && <div className={styles.line} />}
            </div>

            <div className={styles.timelineContent}>
              <div
                className={`${styles.card} ${
                  deletingId === item.id ? styles.isDeleting : ""
                }`}
              >
                {deletingId === item.id ? (
                  <div className={styles.deleteConfirmOverlay}>
                    <p>{t("confirmDelete")}</p>
                    <div className={styles.deleteActions}>
                      <button
                        className={styles.confirmBtn}
                        onClick={() => handleDelete(item.id)}
                      >
                        {t("yes")}
                      </button>
                      <button
                        className={styles.cancelBtn}
                        onClick={() => setDeletingId(null)}
                      >
                        {t("no")}
                      </button>
                    </div>
                  </div>
                ) : editingId === item.id ? (
                  <div className={styles.editForm}>
                    <div className={styles.radioGroup}>
                      {SALARY_TYPES.map((s) => (
                        <label key={s.value} className={styles.radioLabel}>
                          <input
                            type="radio"
                            value={s.value}
                            checked={editForm.salary_type === s.value}
                            onChange={(e) =>
                              setEditForm((p) => ({
                                ...p,
                                salary_type: e.target.value,
                              }))
                            }
                          />
                          {t(s.labelKey)}
                        </label>
                      ))}
                    </div>
                    <div className={styles.formRow}>
                      <label>
                        {t(amountLabelKey[editForm.salary_type])}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editForm.amount}
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, amount: e.target.value }))
                        }
                      />
                    </div>
                    <div className={styles.formRowDates}>
                      <div>
                        <label>{t("dateFrom")}</label>
                        <input
                          type="date"
                          value={editForm.date_from}
                          onChange={(e) =>
                            setEditForm((p) => ({
                              ...p,
                              date_from: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label>{t("dateTo")}</label>
                        <input
                          type="date"
                          value={editForm.date_to}
                          onChange={(e) =>
                            setEditForm((p) => ({
                              ...p,
                              date_to: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className={styles.formRow}>
                      <label>{t("note")}</label>
                      <input
                        type="text"
                        value={editForm.note}
                        onChange={(e) =>
                          setEditForm((p) => ({ ...p, note: e.target.value }))
                        }
                      />
                    </div>
                    <div className={styles.formActions}>
                      <button
                        className={styles.saveBtn}
                        onClick={() => handleEditSave(item.id)}
                        disabled={saving}
                      >
                        {saving ? "..." : t("save")}
                      </button>
                      <button
                        className={styles.cancelBtn}
                        onClick={() => setEditingId(null)}
                      >
                        {t("cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={styles.card_header}>
                      <h4 className={styles.cardTitle}>
                        {salaryTypeLabel(item.salary_type)}
                      </h4>
                      <div className={styles.cardActions}>
                        <button
                          className={styles.editIconBtn}
                          onClick={() => handleEditStart(item)}
                          title={t("edit")}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24">
                            <path
                              d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                        <button
                          className={styles.deleteIconBtn}
                          onClick={() => setDeletingId(item.id)}
                          title={t("delete")}
                        >
                          <svg width="13" height="15" viewBox="0 0 14 18">
                            <path
                              d="M1,16 C1,17.1 1.9,18 3,18 L11,18 C12.1,18 13,17.1 13,16 L13,4 L1,4 L1,16 L1,16 Z M14,1 L10.5,1 L9.5,0 L4.5,0 L3.5,1 L0,1 L0,3 L14,3 L14,1 L14,1 Z"
                              fill="currentColor"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className={styles.card_body}>
                      <p>
                        <span>{t("amount")}:</span>{" "}
                        {Number(item.amount).toLocaleString()}
                      </p>
                      {item.note && (
                        <p>
                          <span>{t("note")}:</span> {item.note}
                        </p>
                      )}
                      <p className={styles.note}>
                        <span>{t("addedBy")}:</span> {formatAddedBy(item)}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {loading && <Loading />}
    </div>
  );
};

export default EmployeeSalaryHistory;
