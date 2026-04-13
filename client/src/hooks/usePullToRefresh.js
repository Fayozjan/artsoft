import { useEffect, useRef } from "react";

export const usePullToRefresh = (onRefresh, containerRef, loading) => {
  const startYRef = useRef(null);
  const pullDistanceRef = useRef(0);

  const loadingRef = useRef(loading);
  const onRefreshRef = useRef(onRefresh);

  const THRESHOLD = 250;

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    const onTouchStart = (e) => {
      if (container.scrollTop <= 0) {
        startYRef.current = e.touches[0].clientY;
        pullDistanceRef.current = 0;
      }
    };

    const onTouchMove = (e) => {
      if (startYRef.current === null) return;

      // если начали скроллить список — отменяем pull
      if (container.scrollTop > 0) {
        startYRef.current = null;
        return;
      }

      const currentY = e.touches[0].clientY;
      const distance = currentY - startYRef.current;

      if (distance > 0) {
        pullDistanceRef.current = distance;
      }
    };

    const onTouchEnd = () => {
      if (startYRef.current === null) return;

      if (pullDistanceRef.current >= THRESHOLD && !loadingRef.current) {
        onRefreshRef.current();
      }

      startYRef.current = null;
      pullDistanceRef.current = 0;
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: true });
    container.addEventListener("touchend", onTouchEnd);

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
    };
  }, [containerRef]);
};
