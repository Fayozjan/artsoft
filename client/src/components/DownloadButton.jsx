import { Download, Loader2 } from "lucide-react";
import styles from "./DownloadButton.module.scss";

const DownloadButton = ({ text = "Сохранить", onClick, loading = false }) => {
  return (
    <button
      className={styles.downloadBtn}
      type="button"
      title={text}
      onClick={onClick}
      disabled={loading}
    >
      {loading ? (
        <Loader2 size={16} className={styles.spinner} />
      ) : (
        <Download size={16} />
      )}
    </button>
  );
};

export default DownloadButton;
