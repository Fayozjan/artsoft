import { useEffect, useRef, useState } from "react";
import styles from "./LateCardListCarousel.module.scss";
import LateMonitoringCard from "./LateMonitoringCard";

const CardListCarousel = ({ data = [] }) => {
  const containerRef = useRef(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const scrollSpeed = 0.5;

  const sortedData = [...data].sort((a, b) =>
    a.employeeFullName.localeCompare(b.employeeFullName),
  );

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

  const duplicatedData = shouldScroll
    ? [...sortedData, ...sortedData]
    : sortedData;
  return (
    <div className={styles.carouselWrapper} ref={containerRef}>
      <div className={styles.cardGrid}>
        {data?.length > 0 &&
          duplicatedData.map((item, i) => <LateMonitoringCard item={item} />)}
      </div>
    </div>
  );
};

export default CardListCarousel;
