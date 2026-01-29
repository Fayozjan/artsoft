"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./OverlaySidebar.module.scss";

export default function OverlaySidebar({
  isOpen,
  onClose,
  children,
  side = "right",
  width = "80%",
  title = "",
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

  const sidebarVariants = {
    hidden: { x: side === "right" ? "100%" : "-100%" },
    visible: { x: 0 },
    exit: { x: side === "right" ? "100%" : "-100%" },
  };

  if (!portalContainer) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="overlay"
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onClose}
        >
          <motion.div
            key="sidebar"
            className={styles.sidebar}
            style={{ width }}
            variants={sidebarVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.3, ease: "easeInOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalContainer
  );
}
