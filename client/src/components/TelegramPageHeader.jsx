import styles from "./TelegramPageHeader.module.scss";

const TelegramPageHeader = ({ title }) => {
  return (
    <header className={styles.header}>
      <span className={styles.title}>{title}</span>
    </header>
  );
};

export default TelegramPageHeader;
