import { useEffect, useRef, useState } from "react";
import styles from "./AttendanceCard.module.scss";

const AttendanceCard = ({ title, value, icon, isPercent = false, onClick }) => {
  const [count, setCount] = useState(0);
  const prevValueRef = useRef(0);
  const rafRef = useRef(null);

  const isNumber = typeof value === "number";

  useEffect(() => {
    if (!isNumber) return;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    const start = prevValueRef.current;
    const end = value;
    const duration = 400;
    const startTime = performance.now();

    const animate = (time) => {
      const progress = Math.min((time - startTime) / duration, 1);
      const current = Math.floor(start + (end - start) * progress);

      setCount(current);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        prevValueRef.current = end;
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.icon}>
        {icon}
        <span className={styles.title}>{title}</span>
      </div>
      <div className={styles.numberWrapper}>
        <div className={styles.number}>
          {isNumber ? count : value || "—"}
          {isPercent && <span className={styles.percent}>%</span>}
        </div>
      </div>
    </div>
  );
};

export default AttendanceCard;
