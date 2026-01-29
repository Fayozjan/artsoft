"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./CenterModal.module.scss";

export default function CenterModal({
  isOpen,
  onClose,
  onAccept,
  title = "Вы уверены?",
  text = "",
  acceptText = "Да",
  cancelText = "Нет",
}) {
  const [portalContainer, setPortalContainer] = useState(null);

  useEffect(() => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    setPortalContainer(container);

    return () => {
      document.body.removeChild(container);
    };
  }, []);

  if (!portalContainer) return null;

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onClose}
        >
          <motion.div
            className={styles.modal}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeInOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>{title}</h2>
            <p>{text}</p>
            <div className={styles.actions}>
              <button className={styles.accept} onClick={onAccept}>
                {acceptText}
              </button>
              <button className={styles.cancel} onClick={onClose}>
                {cancelText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalContainer
  );
}
