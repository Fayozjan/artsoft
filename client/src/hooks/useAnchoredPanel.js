import { useLayoutEffect, useRef, useState } from "react";

const PANEL_MAX = 320;
const PANEL_MIN = 180;

/**
 * Позиционирование выпадающей панели относительно триггера.
 *
 * position: fixed + координаты из getBoundingClientRect: родители с
 * overflow hidden/auto не режут fixed-элемент, портал не нужен — панель
 * остаётся в DOM компонента, поэтому обработчики клика вне у внешних
 * поповеров продолжают работать.
 *
 * Дополнительно фиксирует высоту панели с полным списком (baseHeight),
 * чтобы она не прыгала при фильтрации.
 */
export function useAnchoredPanel(isOpen, triggerRef, resetKey) {
  const panelRef = useRef(null);
  const [coords, setCoords] = useState(null);
  const [baseHeight, setBaseHeight] = useState(null);

  useLayoutEffect(() => {
    if (!isOpen) {
      setCoords(null);
      setBaseHeight(null);
      return;
    }

    const updateCoords = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const spaceBelow = window.innerHeight - rect.bottom - 12;
      const spaceAbove = rect.top - 12;
      const openUp = spaceBelow < PANEL_MIN && spaceAbove > spaceBelow;
      const space = openUp ? spaceAbove : spaceBelow;

      setCoords({
        left: rect.left,
        width: rect.width,
        top: openUp ? undefined : rect.bottom + 6,
        bottom: openUp ? window.innerHeight - rect.top + 6 : undefined,
        maxHeight: Math.max(PANEL_MIN, Math.min(PANEL_MAX, space)),
      });
    };

    updateCoords();
    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);
    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [isOpen, triggerRef]);

  const panelReady = Boolean(coords);

  // высота с полным списком — замеряем один раз за открытие
  useLayoutEffect(() => {
    if (!isOpen || !panelReady || baseHeight !== null) return;
    const height = panelRef.current?.offsetHeight;
    if (height) setBaseHeight(height);
  }, [isOpen, panelReady, baseHeight]);

  // список подгрузился/сменился — замер устарел
  useLayoutEffect(() => {
    setBaseHeight(null);
  }, [resetKey]);

  const panelStyle = coords
    ? {
        left: coords.left,
        width: coords.width,
        top: coords.top,
        bottom: coords.bottom,
        maxHeight: coords.maxHeight,
        minHeight: baseHeight
          ? Math.min(baseHeight, coords.maxHeight)
          : undefined,
      }
    : null;

  return { panelRef, panelReady, panelStyle };
}

export default useAnchoredPanel;
