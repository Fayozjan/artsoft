import { useAlertStore } from "../stores/alertStore";
import { useEffect } from "react";

import styles from "./Alert.module.scss";

export default function Alert() {
  const { visible, message, type, hideAlert } = useAlertStore();

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(hideAlert, 2500);
      return () => clearTimeout(timer);
    }
  }, [visible, hideAlert]);

  if (!visible) return null;

  return <div className={`${styles.alert} ${styles[type]}`}>{message}</div>;
}
