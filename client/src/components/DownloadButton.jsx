import { Download, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import styles from "./DownloadButton.module.scss";

const DownloadButton = ({
  text,
  label = "",
  expanded = false,
  onClick,
  loading = false,
}) => {
  const { t } = useTranslation();
  const btnText = text ?? t("save");
  return (
    <button
      className={`${styles.downloadBtn} ${label && expanded ? styles.expanded : ""}`}
      type="button"
      title={label || btnText}
      onClick={onClick}
      disabled={loading}
    >
      {loading ? (
        <Loader2 size={16} className={styles.spinner} />
      ) : (
        <Download size={16} />
      )}
      {label && (
        <span className={styles.btnLabel} data-fit-label>
          {label}
        </span>
      )}
    </button>
  );
};

export default DownloadButton;
