import { useTranslation } from "react-i18next";

import { STICKER_STATUS_KEYS } from "../utils/stickerStatus";

import styles from "./StickerStatusBadge.module.scss";

const StickerStatusBadge = ({ status }) => {
  const { t } = useTranslation();

  return (
    <span className={`${styles.badge} ${styles[status] || ""}`}>
      {t(STICKER_STATUS_KEYS[status] || "unknown")}
    </span>
  );
};

export default StickerStatusBadge;
