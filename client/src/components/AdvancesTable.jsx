import { useState } from "react";
import { useTranslation } from "react-i18next";
import { payrollApi } from "../api/payroll";
import { useAlertStore } from "../stores/alertStore";
import CenterModal from "./CenterModal";
import { ActionButton } from "./ActionButtons";
import { Icons } from "../icons/icons";
import styles from "./AdvancesTable.module.scss";

const fmt = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00A0");

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const AdvancesTable = ({ advances = [], onDeleted, onEdit }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const [confirmId, setConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const getFullName = (emp) =>
    [emp?.last_name, emp?.first_name, emp?.middle_name].filter(Boolean).join(" ");

  const handleDeleteConfirm = async () => {
    if (!confirmId) return;
    setDeletingId(confirmId);
    setConfirmId(null);
    try {
      const res = await payrollApi.deleteAdvance(confirmId);
      if (res.success) {
        showAlert(t("advanceDeleted"), "success");
        onDeleted?.(confirmId);
      } else {
        showAlert(res.message || t("error"), "error");
      }
    } catch {
      showAlert(t("error"), "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <CenterModal
        isOpen={!!confirmId}
        onClose={() => setConfirmId(null)}
        onAccept={handleDeleteConfirm}
        tag={t("confirmDeleteAdvance")}
      />

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.numCol}>#</th>
              <th style={{ textAlign: "left" }}>{t("employee")}</th>
              <th>{t("advanceDate")}</th>
              <th className={styles.amountCol}>{t("advanceAmount")}</th>
              <th>{t("advanceNote")}</th>
              <th>{t("givenBy")}</th>
              <th className={styles.actCol} style={{ width: 80 }}>{t("action")}</th>
            </tr>
          </thead>
          <tbody>
            {advances.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.noData}>{t("noData")}</td>
              </tr>
            ) : (
              advances.map((adv, idx) => {
                const emp = adv.employee;
                const giver = adv.givenBy;
                const giverName = giver?.employee
                  ? `${getFullName(giver.employee)} (${giver.id})`
                  : giver?.username || "—";

                return (
                  <tr key={adv.id}>
                    <td className={styles.numColTd}>{idx + 1}</td>
                    <td>
                      <div className={styles.empCell}>
                        <span className={styles.empName}>{getFullName(emp)} ({emp.id})</span>
                        <span className={styles.empSub}>
                          {[emp.branch?.name, emp.department?.name].filter(Boolean).join(" / ")}
                        </span>
                      </div>
                    </td>
                    <td className={styles.dateCell}>{fmtDate(adv.advance_date)}</td>
                    <td className={styles.amountCell}>{fmt(adv.amount)}</td>
                    <td className={styles.noteCell}>{adv.note || "—"}</td>
                    <td className={styles.givenByCell}>{giverName}</td>
                    <td style={{ textAlign: "center", verticalAlign: "middle" }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 0 }}>
                        <ActionButton
                          onClick={() => onEdit?.(adv)}
                          icon={Icons.edit}
                          label={t("editAdvanceTitle")}
                          variant="edit"
                        />
                        <ActionButton
                          onClick={() => !deletingId && setConfirmId(adv.id)}
                          icon={Icons.delete}
                          label={t("confirmDeleteAdvance")}
                          variant="delete"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default AdvancesTable;
