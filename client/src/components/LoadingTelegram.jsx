import { useTranslation } from "react-i18next";

import styles from "./LoadingTelegram.module.scss";

const LoadingTelegram = () => {
  const { t } = useTranslation();

  return (
    <div
      className={styles.container}
      role="status"
      aria-live="polite"
      aria-label={t("loading")}
    >
      <div className={styles.dots}>
        <i />
        <i />
        <i />
      </div>
    </div>
  );
};

export default LoadingTelegram;
