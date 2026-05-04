import { useTranslation } from "react-i18next";
import styles from "./Modal.module.scss";

const Modal = ({ onAccept, onClose }) => {
  const { t } = useTranslation();
  return (
    <div className={styles.modal}>
      <button onClick={onAccept} className={styles.accept}>
        {t("yes")}
      </button>
      <button onClick={onClose} className={styles.reject}>
        {t("no")}
      </button>
    </div>
  );
};

export default Modal;
