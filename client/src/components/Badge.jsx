import { useTranslation } from "react-i18next";
import styles from "./Badge.module.scss";

const Badge = ({ text }) => {
  const { t } = useTranslation();

  const map = {
    forward: { text: `🟢 ${t("forward")}`, className: styles.active },
    reverse: { text: `🔴 ${t("reverse")}`, className: styles.inactive },
    active: { text: t("active"), className: styles.active },
    terminated: { text: t("terminated"), className: styles.inactive },
    true: { text: t("true"), className: styles.active },
    false: { text: t("false"), className: styles.inactive },
    entry: { text: t("entry"), className: styles.active },
    exit: { text: t("exit"), className: styles.inactive },
  };

  const value = String(text).toLowerCase();
  const status = map[value];

  if (!status) {
    return <span className={styles.unknown}>❔ {t("unknown")}</span>;
  }

  return <span className={status.className}>{status.text}</span>;
};

export default Badge;
