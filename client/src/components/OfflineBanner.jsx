import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import styles from "./StatusBanner.module.scss";

const RESTORED_VISIBLE_MS = 3000;

const WifiOffIcon = () => (
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
    <line x1="2" y1="2" x2="22" y2="22" />
    <path d="M8.5 16.5a5 5 0 0 1 7 0" />
    <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
    <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" />
    <path d="M16.85 11.25a10 10 0 0 1 2.22 1.68" />
    <path d="M5 13a10 10 0 0 1 5.24-2.76" />
    <line x1="12" y1="20" x2="12.01" y2="20" />
  </svg>
);

const WifiIcon = () => (
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
    <path d="M5 13a10 10 0 0 1 14 0" />
    <path d="M8.5 16.5a5 5 0 0 1 7 0" />
    <path d="M2 8.82a15 15 0 0 1 20 0" />
    <line x1="12" y1="20" x2="12.01" y2="20" />
  </svg>
);

export default function OfflineBanner() {
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const wasOffline = useRef(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      setRestored(false);
      return;
    }

    // "связь вернулась" показываем только после реального обрыва,
    // не при первой загрузке страницы
    if (!wasOffline.current) return;
    wasOffline.current = false;

    setRestored(true);
    const timer = setTimeout(() => setRestored(false), RESTORED_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [isOnline]);

  const visible = !isOnline || restored;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className={`${styles.banner} ${isOnline ? styles.online : styles.offline}`}
          role="status"
          aria-live="polite"
          initial={{ y: -32, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -32, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        >
          <span className={styles.icon}>
            {isOnline ? <WifiIcon /> : <WifiOffIcon />}
          </span>
          <div className={styles.text}>
            <span className={styles.title}>
              {t(isOnline ? "backOnlineTitle" : "offlineTitle")}
            </span>
            <span className={styles.message}>
              {t(isOnline ? "backOnlineMessage" : "offlineMessage")}
            </span>
          </div>
          {!isOnline && <span className={styles.pulse} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
