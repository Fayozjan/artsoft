import { motion } from "framer-motion";

import styles from "./ModalAcceptClose.module.scss";

const ModalAcceptClose = ({ message, onClose, onAccept }) => (
  <div className={styles.overlay}>
    <motion.div
      className={styles.modal}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.3 }}
    >
      <p>{message}</p>
      <div className={styles.modal_buttons}>
        <button onClick={onAccept} className={styles.button_yes}>
          Перейти
        </button>
        <button onClick={onClose} className={styles.button_no}>
          Остаться
        </button>
      </div>
    </motion.div>
  </div>
);

export default ModalAcceptClose;
