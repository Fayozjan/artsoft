import { useAlertStore } from "../stores/alertStore";
import { useEffect } from "react";
import styles from "./Alert.module.scss";

export default function Alert() {
  const { visible, message, type, hideAlert } = useAlertStore();

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(hideAlert, 2800);
      return () => clearTimeout(timer);
    }
  }, [visible, hideAlert]);

  if (!visible) return null;

  return (
    <div className={`${styles.alert} ${styles[type]}`} onClick={hideAlert}>
      <div className={styles.glow} />
      <span className={styles.message}>{message}</span>
    </div>
  );
}
