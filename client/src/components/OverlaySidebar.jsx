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
  width = "550px",
  leftPanel = null,
}) {
  const [portalContainer, setPortalContainer] = useState(null);

  useEffect(() => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    setPortalContainer(container);
    return () => {
      if (document.body.contains(container))
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
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            key="sidebar-wrapper"
            className={styles.sidebarWrapper}
            variants={sidebarVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{ flexDirection: side === "right" ? "row" : "row-reverse" }}
          >
            <AnimatePresence>
              {leftPanel?.isOpen && (
                <motion.div
                  initial={{ opacity: 0, x: side === "right" ? 50 : -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: side === "right" ? 50 : -50 }}
                  className={styles.secondaryPanel}
                  style={{ width: leftPanel.width || "400px" }}
                >
                  {leftPanel.children}
                </motion.div>
              )}
            </AnimatePresence>

            <div className={styles.sidebar} style={{ width }}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalContainer,
  );
}
