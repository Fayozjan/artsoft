import { createPortal } from "react-dom";
import { AnimatePresence, motion, useDragControls } from "framer-motion";

import { IconClose } from "./tgIcons";
import styles from "./TgSheet.module.scss";

// Нижняя шторка Telegram-страниц Производства: затемнение, «ручка», заголовок,
// прокручиваемое тело и закреплённый низ (footer). Закрывается тапом по
// затемнению, крестиком или свайпом вниз за ручку/заголовок — тело при этом
// прокручивается свободно, жест не перехватывает.
// Рендерится в body поверх стека экранов (у него z-index 500).
export default function TgSheet({ isOpen, onClose, title, subtitle, children, footer }) {
  const dragControls = useDragControls();

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
            className={styles.sheet}
            role="dialog"
            aria-modal="true"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 34, stiffness: 380 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose();
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className={styles.dragZone}
              onPointerDown={(e) => dragControls.start(e)}
            >
              <span className={styles.handle} />
              <div className={styles.header}>
                <div className={styles.headerText}>
                  <h2 className={styles.title}>{title}</h2>
                  {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
                </div>
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={onClose}
                  onPointerDown={(e) => e.stopPropagation()}
                  aria-label="close"
                >
                  <IconClose />
                </button>
              </div>
            </div>

            <div className={styles.body}>{children}</div>
            {footer && <div className={styles.footer}>{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
