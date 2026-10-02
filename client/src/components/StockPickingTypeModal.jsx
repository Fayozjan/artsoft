import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";

import { getActiveStockPickingTypes } from "../api";
import { Icons } from "../icons/icons";
import Loading from "./Loading";
import styles from "./StockPickingTypeModal.module.scss";

// Модалка выбора типа документа — первый шаг перед созданием: пользователь
// выбирает "что за документ" (Приём от поставщика, Отгрузка, Перемещение...),
// и только потом открывается страница с полями, уже отфильтрованными под
// логику этого типа (см. AddStockPicking).
const StockPickingTypeModal = ({ isOpen, onClose, onSelect }) => {
  const { t } = useTranslation();
  const [portalContainer, setPortalContainer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [types, setTypes] = useState([]);

  useEffect(() => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    setPortalContainer(container);
    return () => document.body.removeChild(container);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getActiveStockPickingTypes()
      .then((res) => setTypes(res.data || []))
      .catch(() => setTypes([]))
      .finally(() => setLoading(false));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Без AnimatePresence/exit-анимации: при закрытии (выбор типа или отмена)
  // модалка должна пропадать мгновенно, а не "дожевывать" fade-out поверх уже
  // открывшейся страницы документа.
  if (!portalContainer || !isOpen) return null;

  const incomingTypes = types.filter((tp) => tp.code === "incoming");
  const outgoingTypes = types.filter((tp) => tp.code === "outgoing");
  const internalTypes = types.filter(
    (tp) => tp.code !== "incoming" && tp.code !== "outgoing",
  );

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <motion.div
        className={styles.modal}
        initial={{ opacity: 0, scale: 0.92, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={styles.title}>{t("pickingChooseTypeTitle")}</h3>
        <p className={styles.subtitle}>{t("pickingChooseTypeSubtitle")}</p>

        {loading ? (
          <Loading />
        ) : types.length === 0 ? (
          <div className={styles.empty}>{t("noData")}</div>
        ) : (
          <>
            {internalTypes.length > 0 && (
              <div className={styles.internalSection}>
                <div className={`${styles.columnHeader} ${styles.headerInternal}`}>
                  <span className={`${styles.icon} ${styles.iconInternal}`}>
                    {Icons.transfer}
                  </span>
                  {t("pickingTypeCode_internal")}
                </div>
                <div className={styles.columnList}>
                  {internalTypes.map((tp) => (
                    <button
                      key={tp.id}
                      type="button"
                      className={styles.card}
                      onClick={() => onSelect(tp)}
                    >
                      <span className={styles.name}>{tp.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.columns}>
              <div className={styles.column}>
                <div className={`${styles.columnHeader} ${styles.headerIncoming}`}>
                  <span className={`${styles.icon} ${styles.iconIncoming}`}>
                    {Icons.directionIn}
                  </span>
                  {t("pickingTypeCode_incoming")}
                </div>
                <div className={styles.columnList}>
                  {incomingTypes.length === 0 ? (
                    <div className={styles.columnEmpty}>{t("noData")}</div>
                  ) : (
                    incomingTypes.map((tp) => (
                      <button
                        key={tp.id}
                        type="button"
                        className={styles.card}
                        onClick={() => onSelect(tp)}
                      >
                        <span className={styles.name}>{tp.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className={styles.divider} />

              <div className={styles.column}>
                <div className={`${styles.columnHeader} ${styles.headerOutgoing}`}>
                  <span className={`${styles.icon} ${styles.iconOutgoing}`}>
                    {Icons.directionOut}
                  </span>
                  {t("pickingTypeCode_outgoing")}
                </div>
                <div className={styles.columnList}>
                  {outgoingTypes.length === 0 ? (
                    <div className={styles.columnEmpty}>{t("noData")}</div>
                  ) : (
                    outgoingTypes.map((tp) => (
                      <button
                        key={tp.id}
                        type="button"
                        className={styles.card}
                        onClick={() => onSelect(tp)}
                      >
                        <span className={styles.name}>{tp.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        <button type="button" className={styles.closeBtn} onClick={onClose}>
          {t("cancel")}
        </button>
      </motion.div>
    </div>,
    portalContainer,
  );
};

export default StockPickingTypeModal;
