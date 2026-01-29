import { formatLateMinutesToHours } from "../helpers/time";
import styles from "./LateCardList.module.scss";

function formatPermissionEndTime(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString.replace(" ", "T"));

  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CardList = ({ data }) => {
  return (
    <div className={styles.cardGrid}>
      {data.map((item, i) => (
        <div
          className={`card ${styles.card} fade-in`}
          key={item.identifier || i}
        >
          <img
            src={item.actualStartPhoto}
            alt="photo"
            className={styles.photo}
          />
          <span className={styles.monthlyLateCount}>
            {item.monthlyLateCount}
          </span>
          <div className={styles.info}>
            <h4>{item.employeeFullName}</h4>
            <p className={styles.truncateTwoLines}>Филиал: {item.branchName}</p>
            <p className={styles.truncateTwoLines}>
              Отдел: {item.departmentName}
            </p>
            <p className={styles.truncateTwoLines}>
              Должность: {item.positionName}
            </p>
            {item.havePermission && (
              <>
                <p>Отгул: {item.havePermission ? "Да" : "Нет"}</p>
                <p>
                  Конец отгула:
                  {formatPermissionEndTime(item.permissionEndTime)}
                </p>
              </>
            )}

            <p>По графику: {item.scheduledStart?.substring(0, 5)}</p>

            <div style={{ display: "flex", gap: "20px" }}>
              <p>Вход: {item.actualStart}</p>

              <p>Опозд: {formatLateMinutesToHours(item.lateMinutes)}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CardList;
