import LateMonitoringCard from "./LateMonitoringCard";

import styles from "./LateCardList.module.scss";

const CardList = ({ data = [], includeLunch }) => {
  const sortedData = [...data].sort((a, b) =>
    a.employeeFullName.localeCompare(b.employeeFullName),
  );

  return (
    <div className={styles.cardGrid}>
      {sortedData.map((item, i) => (
        <LateMonitoringCard item={item} includeLunch={includeLunch} />
      ))}
    </div>
  );
};

export default CardList;
