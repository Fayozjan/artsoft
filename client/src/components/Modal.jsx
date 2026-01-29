import styles from "./Modal.module.scss";

const Modal = ({ onAccept, onClose }) => {
  return (
    <div className={styles.modal}>
      <button onClick={onAccept} className={styles.accept}>
        Да
      </button>
      <button onClick={onClose} className={styles.reject}>
        Нет
      </button>
    </div>
  );
};

export default Modal;
