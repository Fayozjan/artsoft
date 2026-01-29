import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useAuthStore } from "../stores/authStore";

import styles from "./Badge.module.scss";

const Badge = ({ text }) => {
  const userSettings = useAuthStore((state) => state.userSettings);
  const { i18n, t } = useTranslation();

  useEffect(() => {
    if (userSettings?.language) {
      i18n.changeLanguage(userSettings.language);
    }
  }, [userSettings, i18n]);

  const map = {
    active: {
      text: t("active"),
      className: styles.active,
    },
    terminated: {
      text: t("terminated"),
      className: styles.inactive,
    },
    true: { text: t("true"), className: styles.active },
    false: { text: t("false"), className: styles.inactive },
    entry: { text: t("entry"), className: styles.active },
    exit: { text: t("exit"), className: styles.inactive },
  };

  const value = String(text).toLowerCase();
  const status = map[value];

  if (!status) {
    return <span className={styles.unknown}>Неизвестный</span>;
  }

  return <span className={status.className}>{status.text}</span>;
};

export default Badge;
