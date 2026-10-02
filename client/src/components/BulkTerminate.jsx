import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { addBulkEmploymentOrders } from "../api/employmentOrders";

import Button from "./Button";
import { Icons } from "../icons/icons";
import styles from "./BulkForm.module.scss";

const today = () => new Date().toISOString().slice(0, 10);

// Массовое увольнение: один приказ на всех выделенных сотрудников.
// Тех, кого уволить нельзя (числится имущество, уже уволен), сервер
// возвращает списком — форма остаётся открытой и показывает причины.
const BulkTerminate = ({ employeeIds, handleClose, onSuccess }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const [orderNumber, setOrderNumber] = useState("");
  const [orderDate, setOrderDate] = useState(today());
  const [note, setNote] = useState("");
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setBlocked([]);
    try {
      const res = await addBulkEmploymentOrders({
        employee_ids: employeeIds,
        type: "terminate",
        order_number: orderNumber,
        order_date: orderDate,
        note,
      });

      onSuccess?.(res);

      if (res.blocked?.length) {
        setBlocked(res.blocked);
        showAlert(
          `${t("bulkTerminatedCount")}: ${res.created} · ${t("bulkSkippedCount")}: ${res.blocked.length}`,
          "error",
        );
        return;
      }

      showAlert(`${t("bulkTerminatedCount")}: ${res.created}`, "success");
      setTimeout(handleClose, 1000);
    } catch (err) {
      showAlert(err.response?.data?.message || t("error"), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className={styles.bulkForm} onSubmit={handleSubmit}>
      <div className={styles.header}>
        <h2>
          {t("bulkTerminate")} ({employeeIds.length})
        </h2>
        <span
          onClick={handleClose}
          style={{ display: "flex", cursor: "pointer" }}
        >
          {Icons.clear}
        </span>
      </div>

      <div className={styles.row}>
        <div>
          <label>
            {t("orderNumber")} <span style={{ color: "red" }}>*</span>
          </label>
          <input
            className={styles.textInput}
            type="text"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            required
          />
        </div>
        <div>
          <label>
            {t("orderDate")} <span style={{ color: "red" }}>*</span>
          </label>
          <input
            className={styles.textInput}
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            onFocus={(e) => e.target.showPicker?.()}
            required
          />
        </div>
      </div>

      <div className={styles.row}>
        <div>
          <label>{t("note")}</label>
          <input
            className={styles.textInput}
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      <p className={styles.hint}>{t("bulkTerminateHint")}</p>

      {blocked.length > 0 && (
        <div className={styles.resultBlock}>
          <p className={styles.resultTitle}>
            {t("bulkTerminateBlocked")} ({blocked.length})
          </p>
          <ul>
            {blocked.map((b) => (
              <li key={b.id}>
                {b.name} — {b.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.btnWrapper}>
        <Button
          text={t("save")}
          type="submit"
          disabled={loading}
          loading={loading}
        />
      </div>
    </form>
  );
};

export default BulkTerminate;
