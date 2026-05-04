import { useTranslation } from "react-i18next";
import { Clock, Coffee, Wallet } from "lucide-react";

import { formatLateMinutesToHours } from "../helpers/time";
import { DownloadLate } from "../utils/downloadDoc";

import styles from "./LateEmployeeModal.module.scss";

const fmt = (n) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const LateEmployeeModal = ({ modalData, onClose }) => {
  const { t } = useTranslation();

  if (!modalData) return null;

  const handleDownload = async () => {
    try {
      const today = new Date();
      const monthDate = today.toLocaleDateString("ru-RU", {
        year: "numeric",
        month: "long",
      });
      await DownloadLate.employeeMonth(modalData, monthDate);
    } catch (error) {
      console.error("Download error:", error);
      alert(t("error"));
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderTop}>
            <div className={styles.modalAvatar}>
              {modalData.employeePhoto ? (
                <img
                  src={`/api/employees/image/${modalData.employeePhoto}`}
                  alt=""
                />
              ) : (
                <span>{modalData.employeeFullName?.[0] ?? "?"}</span>
              )}
            </div>

            <div className={styles.modalMeta}>
              <span className={styles.modalLabel}>{t("lateInMonth")}</span>
              <h3 className={styles.modalName}>{modalData.employeeFullName}</h3>
              <span className={styles.modalSub}>
                {modalData.departmentName} · {modalData.positionName}
              </span>
            </div>

            <button
              className={styles.downloadIconBtn}
              onClick={handleDownload}
              title={t("downloadReport")}
              aria-label={t("downloadReport")}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>

            <button
              className={styles.modalClose}
              onClick={onClose}
              title={t("close")}
              aria-label={t("close")}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
              >
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M18 6L6 18M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className={styles.modalStatsGrid}>
          <div className={styles.modalStatWidget}>
            <div
              className={styles.modalStatWidgetIcon}
              style={{ background: "#ef444418" }}
            >
              <Clock size={14} color="#ef4444" strokeWidth={2} />
            </div>
            <div className={styles.modalStatWidgetContent}>
              <span className={styles.modalStatWidgetLabel}>
                {t("lateAtWork")}
              </span>
              <span
                className={styles.modalStatWidgetValue}
                style={{ color: "#ef4444" }}
              >
                {modalData.monthlyArrivalLateCount || 0}
                <span className={styles.modalStatWidgetSub}> {t("times")} </span>
                {modalData.monthlyLateMinutes > 0 && (
                  <span className={styles.modalStatWidgetTime}>
                    ({formatLateMinutesToHours(modalData.monthlyLateMinutes)})
                  </span>
                )}
              </span>
            </div>
          </div>

          <div className={styles.modalStatWidget}>
            <div
              className={styles.modalStatWidgetIcon}
              style={{ background: "#f59e0b18" }}
            >
              <Coffee size={14} color="#f59e0b" strokeWidth={2} />
            </div>
            <div className={styles.modalStatWidgetContent}>
              <span className={styles.modalStatWidgetLabel}>
                {t("afterBreak")}
              </span>
              <span
                className={styles.modalStatWidgetValue}
                style={{ color: "#f59e0b" }}
              >
                {modalData.monthlyLunchLateCount || 0}
                <span className={styles.modalStatWidgetSub}> {t("times")} </span>
                {(modalData.monthlyBreakReturnLateMinutes || 0) > 0 && (
                  <span className={styles.modalStatWidgetTime}>
                    (
                    {formatLateMinutesToHours(
                      modalData.monthlyBreakReturnLateMinutes,
                    )}
                    )
                  </span>
                )}
              </span>
            </div>
          </div>

          <div className={styles.modalStatWidget}>
            <div
              className={styles.modalStatWidgetIcon}
              style={{ background: "#6366f118" }}
            >
              <Wallet size={14} color="#6366f1" strokeWidth={2} />
            </div>
            <div className={styles.modalStatWidgetContent}>
              <span className={styles.modalStatWidgetLabel}>
                {t("latePenaltyAmount")}
              </span>
              <span
                className={styles.modalStatWidgetValue}
                style={{ color: "#6366f1" }}
              >
                {fmt(modalData.monthlyLateMoney)}
              </span>
            </div>
          </div>
        </div>

        <div className={styles.modalBody}>
          <table className={styles.lateTable}>
            <thead>
              <tr>
                <th>№</th>
                <th>{t("date")}</th>
                <th>{t("scheduledStart")}</th>
                <th>{t("actualEntry")}</th>
                <th>{t("lateAtWork")}</th>
                <th>{t("breakEnd")}</th>
                <th>{t("returned")}</th>
                <th>{t("lateAfterBreak")}</th>
              </tr>
            </thead>
            <tbody>
              {modalData.details?.map((item, i) => (
                <tr key={i} className={styles.lateRow}>
                  <td className={styles.lateRowNum}>{i + 1}</td>
                  <td className={styles.lateRowDate}>{item.date}</td>
                  <td className={styles.lateRowSched}>{item.scheduledStart}</td>
                  <td className={styles.lateRowActual}>{item.actualStart}</td>
                  <td className={styles.lateRowLate}>
                    {item.lateMinutes > 0 ? (
                      <span className={styles.latePill}>
                        {formatLateMinutesToHours(item.lateMinutes)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={styles.lateRowSched}>
                    {item.scheduledBreakEnd?.substring(0, 5) || "—"}
                  </td>
                  <td className={styles.lateRowActual}>
                    {item.actualBreakReturn || "—"}
                  </td>
                  <td className={styles.lateRowLate}>
                    {item.breakReturnLateMinutes > 0 ? (
                      <span className={styles.latePill}>
                        {formatLateMinutesToHours(item.breakReturnLateMinutes)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LateEmployeeModal;
