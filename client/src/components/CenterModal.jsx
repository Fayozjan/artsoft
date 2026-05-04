import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";

import styles from "./CenterModal.module.scss";

export default function CenterModal({
  isOpen,
  onClose,
  onAccept,
  tag,
  acceptText,
  cancelText,
}) {
  const { t } = useTranslation();
  const resolvedTag = tag ?? t("confirmAction");
  const resolvedAccept = acceptText ?? t("yes");
  const resolvedCancel = cancelText ?? t("cancel");
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
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 8 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            {resolvedTag && (
              <div className={styles.tag}>
                <span className={styles.tagDot} />
                {resolvedTag}
              </div>
            )}

            {
              <p className={styles.text}>
                {t("confirmText")}
              </p>
            }

            <div className={styles.actions}>
              <button className={styles.accept} onClick={onAccept}>
                {resolvedAccept}
              </button>
              <button className={styles.cancel} onClick={onClose}>
                {resolvedCancel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalContainer,
  );
}
