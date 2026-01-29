import styles from "./NoData.module.scss";

const NoData = ({ title = "По выбранным фильтрам ничего не найдено" }) => {
  return <div className={styles.noData}>{title}</div>;
};

export default NoData;
