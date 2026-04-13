import { formatLateMinutesToHours } from "../helpers/time";
import { DownloadLate } from "../utils/downloadDoc";

import styles from "./LateEmployeeModal.module.scss";

const LateEmployeeModal = ({ modalData, onClose }) => {
  if (!modalData) return null;

  // Обработчик скачивания
  const handleDownload = async () => {
    try {
      // Форматируем дату для названия файла
      const today = new Date();
      const monthDate = today.toLocaleDateString("ru-RU", {
        year: "numeric",
        month: "long",
      });

      // Вызываем функцию скачивания
      await DownloadLate.employeeMonth(modalData, monthDate);
    } catch (error) {
      console.error("Ошибка при скачивании отчёта:", error);
      alert("Ошибка при скачивании отчёта");
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
              <span className={styles.modalLabel}>Опоздания за месяц</span>
              <h3 className={styles.modalName}>{modalData.employeeFullName}</h3>
              <span className={styles.modalSub}>
                {modalData.departmentName} · {modalData.positionName}
              </span>
            </div>

            <button
              className={styles.downloadIconBtn}
              onClick={handleDownload}
              title="Скачать отчёт"
              aria-label="Скачать отчёт"
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
              title="Закрыть"
              aria-label="Закрыть"
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

          <div className={styles.modalStats}>
            <div className={styles.modalStat}>
              <span className={styles.modalStatValue}>
                {modalData.details?.length ?? 0}
              </span>
              <span className={styles.modalStatLabel}>
                Количество опозданий
              </span>
            </div>

            <div className={styles.modalStatDivider} />

            <div className={styles.modalStat}>
              <span className={styles.modalStatValue}>
                {formatLateMinutesToHours(modalData.monthlyLateMinutes)}
              </span>
              <span className={styles.modalStatLabel}>
                Суммарное время опоздания
              </span>
            </div>

            <div className={styles.modalStatDivider} />

            <div className={styles.modalStat}>
              <span className={styles.modalStatValue}>
                {modalData.monthlyLateMoney ?? "0"}
              </span>
              <span className={styles.modalStatLabel}>Сумма за опоздания</span>
            </div>
          </div>
        </div>

        <div className={styles.modalBody}>
          <table className={styles.lateTable}>
            <thead>
              <tr>
                <th>№</th>
                <th>Дата</th>
                <th>По графику</th>
                <th>Фактический вход</th>
                <th>Опоздание (чч:мм)</th>
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
                    <span className={styles.latePill}>
                      {formatLateMinutesToHours(item.lateMinutes)}
                    </span>
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
