import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { useAlertStore } from "../stores/alertStore";
import styles from "./StatusBanner.module.scss";

const VISIBLE_MS = { success: 3000, error: 4500 };

const ErrorIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const SuccessIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export default function AlertBanner() {
  const { t } = useTranslation();
  const { visible, message, type, hideAlert } = useAlertStore();
  const show = visible && (type === "error" || type === "success");

  useEffect(() => {
    // message в deps: новый alert при уже открытом баннере должен
    // заново запускать таймер, а не наследовать обратный отсчёт первого
    if (show) {
      const timer = setTimeout(hideAlert, VISIBLE_MS[type]);
      return () => clearTimeout(timer);
    }
  }, [show, message, type, hideAlert]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className={`${styles.banner} ${styles[type]} ${styles.dismissible}`}
          role={type === "error" ? "alert" : "status"}
          aria-live={type === "error" ? "assertive" : "polite"}
          onClick={hideAlert}
          initial={{ y: -32, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -32, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        >
          <span className={styles.icon}>
            {type === "error" ? <ErrorIcon /> : <SuccessIcon />}
          </span>
          <div className={styles.text}>
            {type === "error" ? (
              <>
                <span className={styles.title}>{t("errorTitle")}</span>
                <span className={styles.message}>{message}</span>
              </>
            ) : (
              // success почти всегда шлёт общий t("success") = "Успешно" —
              // отдельный заголовок дублировал бы это слово
              <span className={styles.title}>{message}</span>
            )}
          </div>
          {type === "error" && <span className={styles.pulse} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
