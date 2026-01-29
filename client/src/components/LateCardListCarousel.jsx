import { useEffect, useRef, useState } from "react";
import styles from "./LateCardListCarousel.module.scss";

function formatPermissionEndTime(dateString) {
  if (!dateString) return "";

  const date = new Date(dateString.replace(" ", "T"));

  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const CardListCarousel = ({ data }) => {
  const containerRef = useRef(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const scrollSpeed = 0.5;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const checkScroll = () => {
      const { scrollHeight, clientHeight } = container;
      setShouldScroll(scrollHeight > clientHeight + 1);
    };

    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [data]);

  useEffect(() => {
    if (!shouldScroll) return;

    const container = containerRef.current;
    let animationFrameId;

    const scroll = () => {
      if (!container) return;

      container.scrollTop += scrollSpeed;
      if (container.scrollTop >= container.scrollHeight / 2) {
        container.scrollTop = 0;
      }

      animationFrameId = requestAnimationFrame(scroll);
    };

    animationFrameId = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(animationFrameId);
  }, [shouldScroll, data]);

  const duplicatedData = shouldScroll ? [...data, ...data] : data;

  return (
    <div className={styles.carouselWrapper} ref={containerRef}>
      <div className={styles.cardGrid}>
        {duplicatedData.map((item, i) => (
          <div
            className={`card ${styles.card}`}
            key={`${item.identifier || i}-${i}`}
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
              <p className={styles.truncateTwoLines}>
                Филиал: {item.branchName}
              </p>
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
                    Конец отгула:{" "}
                    {formatPermissionEndTime(item.permissionEndTime)}
                  </p>
                </>
              )}
              <p>По графику: {item.scheduledStart?.substring(0, 5)}</p>
              <div className={styles.time}>
                <p>Вход: {item.actualStart}</p>
                <p>
                  Опозд:{" "}
                  {`${Math.floor(item.lateMinutes / 60)
                    .toString()
                    .padStart(2, "0")}:${(item.lateMinutes % 60)
                    .toString()
                    .padStart(2, "0")}`}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CardListCarousel;
