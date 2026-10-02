import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const LABEL_GAP = 6; // отступ между иконкой и подписью
const BUFFER = 8; // запас, чтобы подписи не мигали на границе

/**
 * Показывает подписи у кнопок, когда строка помещается по ширине,
 * и схлопывает их обратно в иконки, когда места мало.
 *
 * rowRef — контейнер-строка (flex), внутри которой стоят кнопки.
 * Подписи помечаются атрибутом data-fit-label и в свёрнутом виде
 * скрываются через max-width: 0 (scrollWidth остаётся реальным).
 */
export const useFitLabels = (rowRef, key) => {
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);

  const measure = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;

    const children = Array.from(row.children);
    if (!children.length) return;

    const cs = getComputedStyle(row);
    const avail =
      row.clientWidth -
      (parseFloat(cs.paddingLeft) || 0) -
      (parseFloat(cs.paddingRight) || 0);

    const gap = parseFloat(cs.columnGap) || 0;
    const required =
      children.reduce((sum, el) => sum + el.offsetWidth, 0) +
      gap * (children.length - 1);

    // В свёрнутом виде подписи не занимают места — считаем, сколько добавят.
    let extra = 0;
    if (!expandedRef.current) {
      row.querySelectorAll("[data-fit-label]").forEach((el) => {
        extra += el.scrollWidth + LABEL_GAP;
      });
      if (!extra) return;
    }

    const next = expandedRef.current
      ? required <= avail
      : required + extra + BUFFER <= avail;

    if (next !== expandedRef.current) {
      expandedRef.current = next;
      setExpanded(next);
    }
  }, [rowRef]);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    measure();

    const ro = new ResizeObserver(measure);
    const observe = () => {
      ro.disconnect();
      ro.observe(row);
      Array.from(row.children).forEach((el) => ro.observe(el));
    };
    observe();

    // Состав строки меняется (пагинация, фильтры) — пересобираем наблюдение.
    const mo = new MutationObserver(() => {
      observe();
      measure();
    });
    mo.observe(row, { childList: true });

    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [measure, rowRef]);

  // Смена языка меняет длину подписей — пересчитываем.
  useEffect(() => {
    measure();
  }, [key, measure]);

  return expanded;
};
