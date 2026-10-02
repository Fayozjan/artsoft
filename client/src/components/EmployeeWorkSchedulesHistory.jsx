import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

import Loading from "./Loading";
import styles from "./EmployeeWorkSchedulesHistory.module.scss";
import { EmployeeService, workScheduleHistoryApi } from "../api";
import { t } from "i18next";
import { Icons } from "../icons/icons";
import { formatWorkScheduleTime } from "../utils/workSchedule";

const EmployeeWorkSchedulesHistory = ({ employeeId, handleClose }) => {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [deletingId, setDeletingId] = useState(null);

  const fetchHistory = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const res = await EmployeeService.getById(employeeId);
      if (res?.success) {
        // Сортируем историю по убыванию даты (новые сверху)
        const sorted = (res?.data?.employeeScheduleHistory || []).sort(
          (a, b) => new Date(b.date_from) - new Date(a.date_from),
        );
        setHistory(sorted);
      }
    } catch (e) {
      console.error("Ошибка загрузки истории графиков", e);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const confirmDelete = async (id) => {
    setLoading(true);
    try {
      const res = await workScheduleHistoryApi.deleteById(id);
      if (res?.success) {
        setHistory((prev) => prev.filter((i) => i.id !== id));
      }
    } catch (e) {
      console.error("Ошибка удаления записи графика", e);
    } finally {
      setDeletingId(null);
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span onClick={handleClose} style={{ cursor: "pointer", display: "flex" }}>{Icons.clear}</span>
      </div>

      <div className={styles.timelineWrapper}>
        {!loading && history.length === 0 && (
          <div className={styles.empty}>{t("historyEmpty")}</div>
        )}

        {history.map((item, index) => (
          <div key={item.id} className={styles.timeline_item}>
            {/* Левая колонка: Дата */}
            <div className={styles.timeline_date}>
              <div className={styles.date_start}>
                {format(new Date(item.date_from), "dd MMM yyyy", {
                  locale: ru,
                })}
              </div>
              <div className={styles.date_sep}>↓</div>
              <div className={styles.date_end}>
                {item.date_to
                  ? format(new Date(item.date_to), "dd MMM yyyy", {
                      locale: ru,
                    })
                  : t("presentToDate")}
              </div>
            </div>

            {/* Центральная колонка: Линия и точка */}
            <div className={styles.timeline_path}>
              <div className={styles.dot} />
              {index !== history.length - 1 && <div className={styles.line} />}
            </div>

            {/* Правая колонка: Контент */}
            <div className={styles.timelineContent}>
              <div
                className={`${styles.card} ${deletingId === item.id ? styles.isDeleting : ""}`}
              >
                {deletingId === item.id ? (
                  <div className={styles.deleteConfirmOverlay}>
                    <p>{t("deleteRecord")}</p>
                    <div className={styles.deleteActions}>
                      <button
                        className={styles.confirmBtn}
                        onClick={() => confirmDelete(item.id)}
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
                ) : (
                  <>
                    <div className={styles.card_header}>
                      <h4 className={styles.title}>{t("workScheduleTitle")}</h4>
                      <button
                        className={styles.deleteIconBtn}
                        onClick={() => setDeletingId(item.id)}
                        title={t("deleteBtn")}
                      >
                        {Icons.delete}
                      </button>
                    </div>
                    <div className={styles.card_body}>
                      <p>
                        <span>{t("scheduleName")}:</span>{" "}
                        {item?.workSchedule?.name}
                      </p>
                      <p>
                        <span>{t("type")}:</span>
                        {t(`scheduleType.${item?.workSchedule?.type}`)}
                      </p>
                      <p>
                        <span>{t("workMode")}:</span>{" "}
                        {formatWorkScheduleTime(item?.workSchedule)}
                      </p>
                      <p>
                        <span>{t("assigned")}:</span>{" "}
                        {format(new Date(item.added_at), "dd.MM.yyyy HH:mm")}
                      </p>

                      <p className={styles.note}>
                        <span>{t("addedBy")}:</span> {item.addedBy}
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

export default EmployeeWorkSchedulesHistory;
