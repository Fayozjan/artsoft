import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { PackageX, ShieldAlert, Package, CalendarClock, Hash, X } from "lucide-react";

import styles from "./TerminationBlockedModal.module.scss";

const formatDate = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU");
};

// возврат просрочен, если плановая дата уже в прошлом
const isOverdue = (value) => {
  if (!value) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(value) < today;
};

const TerminationBlockedModal = ({
  isOpen,
  onClose,
  employeeName,
  assets = [],
  onGoToAssets,
}) => {
  const { t } = useTranslation();
  const [portalContainer, setPortalContainer] = useState(null);

  useEffect(() => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    setPortalContainer(container);
    return () => document.body.removeChild(container);
  }, []);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!portalContainer) return null;

  const totalQuantity = assets.reduce((sum, a) => sum + (a.quantity || 1), 0);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className={styles.modal}
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.header}>
              <div className={styles.headerIcon}>
                <PackageX size={20} />
              </div>
              <div className={styles.headerText}>
                <h3 className={styles.title}>{t("terminationBlockedTitle")}</h3>
                {employeeName && <span className={styles.subtitle}>{employeeName}</span>}
              </div>
              <button type="button" className={styles.close} onClick={onClose}>
                <X size={16} />
              </button>
            </div>

            <div className={styles.banner}>
              <ShieldAlert size={16} className={styles.bannerIcon} />
              <p className={styles.bannerText}>{t("terminationBlockedMessage")}</p>
            </div>

            <div className={styles.summary}>
              <span className={styles.summaryLabel}>{t("assetsOnHand")}</span>
              <span className={styles.summaryValue}>
                {t("terminationBlockedCount", {
                  positions: assets.length,
                  quantity: totalQuantity,
                })}
              </span>
            </div>

            <ul className={styles.list}>
              {assets.map((asset) => {
                const overdue = isOverdue(asset.expected_return_date);
                const meta = [asset.asset_spec, asset.asset_condition].filter(Boolean);

                return (
                  <li key={asset.id} className={styles.item}>
                    <div className={styles.itemIcon}>
                      <Package size={15} />
                    </div>

                    <div className={styles.itemBody}>
                      <div className={styles.itemName}>
                        {asset.asset_name}
                        {asset.quantity > 1 && (
                          <span className={styles.itemQty}>×{asset.quantity}</span>
                        )}
                      </div>

                      {(meta.length > 0 || asset.inventory_number) && (
                        <div className={styles.itemMeta}>
                          {meta.map((part, i) => (
                            <span key={i} className={styles.metaPart}>
                              {part}
                            </span>
                          ))}
                          {asset.inventory_number && (
                            <span className={styles.metaPart}>
                              <Hash size={11} />
                              {asset.inventory_number}
                            </span>
                          )}
                        </div>
                      )}

                      <div className={styles.itemDates}>
                        <span>
                          {t("assignedDate")}: <strong>{formatDate(asset.assigned_date)}</strong>
                        </span>
                        {asset.expected_return_date && (
                          <span className={overdue ? styles.overdue : ""}>
                            <CalendarClock size={11} />
                            {t("expectedReturnDate")}:{" "}
                            <strong>{formatDate(asset.expected_return_date)}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    {overdue && (
                      <span className={styles.overdueChip}>{t("returnOverdue")}</span>
                    )}
                  </li>
                );
              })}
            </ul>

            <div className={styles.actions}>
              {onGoToAssets && (
                <button type="button" className={styles.primary} onClick={onGoToAssets}>
                  {t("goToAssets")}
                </button>
              )}
              <button type="button" className={styles.secondary} onClick={onClose}>
                {t("understood")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalContainer,
  );
};

export default TerminationBlockedModal;
