import { Icons } from "../icons/icons";
import styles from "./DownloadButton.module.scss";

const DownloadButton = ({ text = "Сохранить", onClick }) => {
  return (
    <button className={styles.downloadBtn} type="button" onClick={onClick}>
      {Icons.download}
    </button>
  );
};

export default DownloadButton;
