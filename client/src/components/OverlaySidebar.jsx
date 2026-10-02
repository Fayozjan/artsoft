"use client";

import { useEffect, useRef, useState } from "react";
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
  // Клик по оверлею закрывает панель только если нажатие мыши началось
  // на самом оверлее. Иначе выделение текста внутри панели с отпусканием
  // кнопки за её пределами закрывало бы панель.
  const pressedOnOverlay = useRef(false);
  const overlayRef = useRef(null);

  // Страховка от зависшего framer-motion exit: если внутри панели есть
  // вложенные draggable motion.div (canvas-редактор стикера), AnimatePresence
  // иногда не вызывает onExitComplete и оверлей (position:fixed на весь экран,
  // z-index поверх всего) навсегда остаётся в DOM с pointer-events:auto —
  // невидимый, но блокирующий клики по всей странице до перезагрузки. Не
  // полагаемся на анимацию — гасим клики сразу, как только isOpen стал false.
  // При повторном открытии тот же непримонтированный узел иногда оживает
  // заново (framer возвращает его из "exiting" в "present") — inline-стиль
  // никто кроме нас не трогает, поэтому обязательно возвращаем pointerEvents
  // обратно при открытии, иначе новая панель окажется некликабельной.
  useEffect(() => {
    if (overlayRef.current) {
      overlayRef.current.style.pointerEvents = isOpen ? "" : "none";
    }
  }, [isOpen]);

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
          ref={overlayRef}
          className={styles.overlay}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onMouseDown={(e) => {
            pressedOnOverlay.current = e.target === e.currentTarget;
          }}
          onMouseUp={(e) => {
            const shouldClose =
              pressedOnOverlay.current && e.target === e.currentTarget;
            pressedOnOverlay.current = false;
            if (shouldClose) onClose?.();
          }}
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
