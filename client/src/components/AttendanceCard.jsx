import { useEffect, useRef, useState } from "react";
import styles from "./AttendanceCard.module.scss";

const AttendanceCard = ({
  title,
  value,
  icon,
  isPercent = false,
  onClick,
  color = "#6366f1",
  progress,
  sub,
}) => {
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
      <div className={styles.inner}>
        <div className={styles.iconBox} style={{ background: color + "18" }}>
          {icon}
        </div>
        <div className={styles.content}>
          <span className={styles.label}>{title}</span>
          <span className={styles.value} style={{ color }}>
            {isNumber ? count : value || "—"}
            {isPercent && <span className={styles.sub}>%</span>}
            {sub && <span className={styles.sub}>{sub}</span>}
          </span>
        </div>
      </div>
      {progress != null && (
        <div className={styles.progressTrack}>
          <div
            className={styles.progressFill}
            style={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
              background: color,
            }}
          />
        </div>
      )}
    </div>
  );
};

export default AttendanceCard;
