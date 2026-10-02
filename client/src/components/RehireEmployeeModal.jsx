import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { EmployeeService } from "../api";
import { Icons } from "../icons/icons";
import { formatIsoToLocalDate } from "../utils/date";

import EmployeeCell from "./EmployeeCell";
import styles from "./RehireEmployeeModal.module.scss";

// Список всех уволенных сотрудников (status=false), в т.ч. из других филиалов, которых логин не видит в обычном списке.
// Выбор строки подгружает данные сотрудника и отдаёт их родителю: onSelect(data, listItem).
// Рендерится через портал — форма приёма сама лежит в OverlaySidebar.
const RehireEmployeeModal = ({ isOpen, onClose, onSelect }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pickingId, setPickingId] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    setSearch("");
    setItems([]);
    setTotal(0);
  }, [isOpen]);

  // Поиск с задержкой; устаревший ответ отбрасываем, если запрос успели сменить
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await EmployeeService.getRehireCandidates({
          search: search.trim() || undefined,
        });
        if (cancelled) return;
        setItems(res.data || []);
        setTotal(res.total || 0);
      } catch (err) {
        if (!cancelled) {
          showAlert(err?.response?.data?.error || t("error"), "error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, search]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    // capture — чтобы Esc закрыл только модалку, а не форму под ней
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isOpen, onClose]);

  const handlePick = async (item) => {
    if (pickingId !== null) return;

    setPickingId(item.id);
    try {
      const res = await EmployeeService.getRehireCandidate(item.id);
      onSelect(res.data, item);
    } catch (err) {
      showAlert(err?.response?.data?.error || t("error"), "error");
    } finally {
      setPickingId(null);
    }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <motion.div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.header}>
              <h2 className={styles.title}>{t("rehireModalTitle")}</h2>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={onClose}
                aria-label={t("close")}
              >
                {Icons.clear}
              </button>
            </div>

            <div className={styles.searchBox}>
              <input
                type="text"
                className={styles.searchInput}
                placeholder={t("rehireSearchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            <div className={styles.body}>
              {items.length > 0 ? (
                <div className={styles.list}>
                  {items.map((item) => (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      aria-disabled={pickingId !== null}
                      className={`${styles.card} ${pickingId !== null ? styles.busy : ""}`}
                      onClick={() => handlePick(item)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handlePick(item);
                      }}
                    >
                      {/* Тот же вид, что на странице «Сотрудники»: аватарка (красная рамка — уволен) + ФИО + филиал / отдел / должность */}
                      <div className={styles.cardCell}>
                        <EmployeeCell
                          photo={item.photo}
                          lastName={item.last_name}
                          firstName={item.first_name}
                          middleName={item.middle_name}
                          id={item.id}
                          branch={item.branch_name}
                          department={item.department_name}
                          position={item.position_name}
                          active={false}
                          alwaysShowBranch
                          previewable={false}
                        />
                      </div>
                      <div className={styles.cardSide}>
                        {item.pinfl && (
                          <span className={styles.cardMeta}>{item.pinfl}</span>
                        )}
                        {item.fired_date && (
                          <span className={styles.cardFired}>
                            {t("rehireFiredOn", {
                              date: formatIsoToLocalDate(item.fired_date),
                            })}
                          </span>
                        )}
                        {pickingId === item.id && (
                          <span className={styles.cardLoading}>
                            {t("loading")}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.empty}>
                  {loading ? t("loading") : t("rehireEmpty")}
                </div>
              )}
            </div>

            {total > items.length && (
              <div className={styles.footer}>
                {t("rehireShowingFirst", { shown: items.length, total })}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default RehireEmployeeModal;
