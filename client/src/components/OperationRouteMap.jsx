import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { getOperationTypes } from "../api";

import Loading from "./Loading";
import { Icons } from "../icons/icons";
import styles from "./OperationRouteMap.module.scss";

const NODE_W = 210;
const NODE_H = 60;
const COL_GAP = 110;
const ROW_GAP = 22;
const PAD = 32;
// Петли "назад" уходят под схему: первая на LOOP_BASE ниже, каждая следующая на LOOP_STEP глубже.
const LOOP_BASE = 28;
const LOOP_STEP = 14;
// Разные виды связей у одной операции выходят из разных точек, а не из одной.
const KIND_SHIFT = { next: 0, rework: -18, incomplete: 18 };

const KINDS = ["next", "rework", "incomplete"];
const KIND_LABEL_KEYS = {
  next: "operationRouteNext",
  rework: "operationRouteRework",
  incomplete: "operationRouteIncomplete",
};
const KIND_CLASS = {
  next: styles.kindNext,
  rework: styles.kindRework,
  incomplete: styles.kindIncomplete,
};

// Связи между типами: следующая операция, исправление, не выполненное. Как и в
// приёме работы: у последней операции следующих нет, "не выполненное" — только если
// оно разрешено у типа. Связь на скрытый (неактивный) тип не рисуем.
const collectEdges = (types) => {
  const ids = new Set(types.map((type) => type.id));
  const seen = new Set();
  const edges = [];
  const add = (from, to, kind) => {
    const key = `${kind}:${from}>${to}`;
    if (!to || from === to || !ids.has(to) || seen.has(key)) return;
    seen.add(key);
    edges.push({ key, from, to, kind });
  };

  types.forEach((type) => {
    if (!type.is_final) {
      (type.nextOperations || []).forEach((rel) => add(type.id, rel.nextOperationType?.id, "next"));
    }
    (type.reworkOperations || []).forEach((rel) => add(type.id, rel.reworkOperationType?.id, "rework"));
    if (type.allow_incomplete) {
      (type.incompleteOperations || []).forEach((rel) =>
        add(type.id, rel.incompleteOperationType?.id, "incomplete"),
      );
    }
  });
  return edges;
};

// Раскладка слева направо: колонка = самая длинная цепочка до операции. Связи,
// замыкающие круг (например "не выполненное" назад в цепочку), на колонки не влияют —
// рисуются петлёй под схемой.
const layoutGraph = (types, edges) => {
  const order = new Map(types.map((type, index) => [type.id, index]));
  const out = new Map(types.map((type) => [type.id, []]));
  const hasIncoming = new Set();
  edges.forEach((edge) => {
    out.get(edge.from).push(edge);
    hasIncoming.add(edge.to);
  });

  // Обход в глубину: связь в операцию из текущей цепочки — обратная.
  const state = new Map();
  const back = new Set();
  const finished = [];
  const visit = (id) => {
    state.set(id, 1);
    out.get(id).forEach((edge) => {
      const s = state.get(edge.to);
      if (s === 1) back.add(edge.key);
      else if (!s) visit(edge.to);
    });
    state.set(id, 2);
    finished.push(id);
  };
  // Начинаем с первой операции, затем с тех, в которые никто не ведёт.
  const rank = (type) => (type.is_first ? 0 : hasIncoming.has(type.id) ? 2 : 1);
  [...types]
    .sort((a, b) => rank(a) - rank(b) || order.get(a.id) - order.get(b.id))
    .forEach((type) => {
      if (!state.get(type.id)) visit(type.id);
    });

  const level = new Map(types.map((type) => [type.id, 0]));
  const predecessors = new Map(types.map((type) => [type.id, []]));
  [...finished].reverse().forEach((id) => {
    out.get(id).forEach((edge) => {
      if (back.has(edge.key)) return;
      level.set(edge.to, Math.max(level.get(edge.to), level.get(id) + 1));
      predecessors.get(edge.to).push(id);
    });
  });

  const columns = [];
  types.forEach((type) => {
    const col = level.get(type.id);
    if (!columns[col]) columns[col] = [];
    columns[col].push(type);
  });
  const maxRows = Math.max(1, ...columns.map((column) => column.length));

  // Колонки центрируем по вертикали; порядок в колонке — по средней высоте тех, кто в неё ведёт.
  const pos = new Map();
  columns.forEach((column, col) => {
    if (col > 0) {
      const weight = (type) => {
        const ys = predecessors.get(type.id).map((id) => pos.get(id).y);
        return ys.length ? ys.reduce((sum, y) => sum + y, 0) / ys.length : 1e9;
      };
      column.sort((a, b) => weight(a) - weight(b) || order.get(a.id) - order.get(b.id));
    }
    const offset = (maxRows - column.length) / 2;
    column.forEach((type, row) => {
      pos.set(type.id, {
        col,
        x: PAD + col * (NODE_W + COL_GAP),
        y: PAD + (row + offset) * (NODE_H + ROW_GAP),
      });
    });
  });

  const graphBottom = PAD + maxRows * NODE_H + (maxRows - 1) * ROW_GAP;
  let loops = 0;
  const paths = edges.map((edge) => {
    const from = pos.get(edge.from);
    const to = pos.get(edge.to);

    if (!back.has(edge.key)) {
      const x1 = from.x + NODE_W;
      const y1 = from.y + NODE_H / 2;
      const x2 = to.x;
      const y2 = to.y + NODE_H / 2;
      const dx = Math.max(40, (x2 - x1) / 2);
      return { ...edge, d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}` };
    }

    const shift = KIND_SHIFT[edge.kind];
    const x1 = from.x + NODE_W / 2 + shift;
    const y1 = from.y + NODE_H;
    const x2 = to.x + NODE_W / 2 + shift;
    const y2 = to.y + NODE_H;
    // Кубическая кривая доходит лишь на 3/4 до контрольных точек — вытягиваем их на 4/3,
    // чтобы петля прошла именно на глубине loopY.
    const loopY = graphBottom + LOOP_BASE + LOOP_STEP * loops;
    const cy1 = y1 + ((loopY - y1) * 4) / 3;
    const cy2 = y2 + ((loopY - y2) * 4) / 3;
    loops += 1;
    return { ...edge, d: `M${x1},${y1} C${x1},${cy1} ${x2},${cy2} ${x2},${y2}` };
  });

  return {
    pos,
    paths,
    width: PAD * 2 + columns.length * NODE_W + (columns.length - 1) * COL_GAP,
    height: graphBottom + PAD + (loops > 0 ? LOOP_BASE + LOOP_STEP * (loops - 1) : 0),
  };
};

const LegendLine = ({ kind }) => (
  <svg className={`${styles.legendLine} ${KIND_CLASS[kind]}`} width="38" height="10" aria-hidden="true">
    <line x1="1" y1="5" x2="31" y2="5" />
    <path d="M28,1.5 L36,5 L28,8.5 z" />
  </svg>
);

// Схема "как связаны типы операций" — только для ознакомления, ничего не меняет.
// Наведение или клик по операции подсвечивает её связи, остальное притухает.
const OperationRouteMap = ({ onClose }) => {
  const { t } = useTranslation();

  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [hoverId, setHoverId] = useState(null);
  const [pinnedId, setPinnedId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Схеме нужны все типы разом, а не страница списка.
        const { data } = await getOperationTypes({ page: 1, pageSize: 1000 });
        if (!cancelled) setTypes(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasInactive = types.some((type) => !type.is_active);
  const visibleTypes = useMemo(
    () => (showInactive ? types : types.filter((type) => type.is_active)),
    [types, showInactive],
  );
  const edges = useMemo(() => collectEdges(visibleTypes), [visibleTypes]);
  const graph = useMemo(
    () => (visibleTypes.length > 0 ? layoutGraph(visibleTypes, edges) : null),
    [visibleTypes, edges],
  );

  const focusId = hoverId ?? pinnedId;
  const linked = useMemo(() => {
    if (focusId == null) return null;
    const ids = new Set([focusId]);
    edges.forEach((edge) => {
      if (edge.from === focusId) ids.add(edge.to);
      if (edge.to === focusId) ids.add(edge.from);
    });
    return ids;
  }, [focusId, edges]);

  const isEdgeActive = (edge) => focusId != null && (edge.from === focusId || edge.to === focusId);
  const nameById = useMemo(() => new Map(types.map((type) => [type.id, type.name])), [types]);

  const nodeClass = (type) =>
    [
      styles.node,
      type.is_rework ? styles.roleRework : type.is_first ? styles.roleFirst : type.is_final ? styles.roleFinal : "",
      !type.is_active ? styles.nodeInactive : "",
      linked && !linked.has(type.id) ? styles.nodeDim : "",
      type.id === focusId ? styles.nodeFocus : "",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <div className={styles.page}>
      {loading && <Loading />}

      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onClose}>
          {Icons.arrowBack}
          <span>{t("back")}</span>
        </button>
        <div className={styles.headerText}>
          <span className={styles.eyebrow}>{t("operationTypes")}</span>
          <h2>{t("operationRoute")}</h2>
        </div>
      </div>

      <div className={styles.toolbar}>
        <ul className={styles.legend}>
          {KINDS.map((kind) => (
            <li key={kind}>
              <LegendLine kind={kind} />
              <span>{t(KIND_LABEL_KEYS[kind])}</span>
            </li>
          ))}
        </ul>

        {hasInactive && (
          <label className={styles.toggle}>
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            <span>{t("operationRouteShowInactive")}</span>
          </label>
        )}

        <span className={styles.hint}>{t("operationRouteHint")}</span>
      </div>

      <div className={styles.scroll}>
        {graph ? (
          <div
            className={styles.canvas}
            style={{ width: graph.width, height: graph.height }}
            onClick={() => setPinnedId(null)}
          >
            <svg className={styles.edges} width={graph.width} height={graph.height} aria-hidden="true">
              <defs>
                {KINDS.map((kind) => (
                  <marker
                    key={kind}
                    id={`route-arrow-${kind}`}
                    className={KIND_CLASS[kind]}
                    viewBox="0 0 8 8"
                    refX="7"
                    refY="4"
                    markerWidth="8"
                    markerHeight="8"
                    markerUnits="userSpaceOnUse"
                    orient="auto"
                  >
                    <path d="M0,0 L8,4 L0,8 z" />
                  </marker>
                ))}
              </defs>

              {/* Подсвеченные связи рисуем последними — поверх остальных. */}
              {[...graph.paths]
                .sort((a, b) => Number(isEdgeActive(a)) - Number(isEdgeActive(b)))
                .map((edge) => {
                  const active = isEdgeActive(edge);
                  const cls = [
                    styles.edge,
                    KIND_CLASS[edge.kind],
                    active ? styles.edgeActive : "",
                    focusId != null && !active ? styles.edgeDim : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <path key={edge.key} className={cls} d={edge.d} markerEnd={`url(#route-arrow-${edge.kind})`}>
                      <title>
                        {nameById.get(edge.from)} → {nameById.get(edge.to)} ({t(KIND_LABEL_KEYS[edge.kind])})
                      </title>
                    </path>
                  );
                })}
            </svg>

            {visibleTypes.map((type) => {
              const { x, y } = graph.pos.get(type.id);
              return (
                <button
                  key={type.id}
                  type="button"
                  className={nodeClass(type)}
                  style={{ left: x, top: y, width: NODE_W, height: NODE_H }}
                  aria-pressed={pinnedId === type.id}
                  onMouseEnter={() => setHoverId(type.id)}
                  onMouseLeave={() => setHoverId(null)}
                  onFocus={() => setHoverId(type.id)}
                  onBlur={() => setHoverId(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPinnedId((prev) => (prev === type.id ? null : type.id));
                  }}
                >
                  <span className={styles.nodeName} title={type.name}>
                    {type.name}
                  </span>
                  <span className={styles.chips}>
                    {type.is_first && <i className={styles.chipFirst}>{t("operationRouteFirst")}</i>}
                    {type.is_final && <i className={styles.chipFinal}>{t("operationRouteFinal")}</i>}
                    {type.is_rework && <i className={styles.chipRework}>{t("isReworkOperation")}</i>}
                    {!type.is_active && <i className={styles.chipInactive}>{t("operationRouteInactive")}</i>}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          !loading && <div className={styles.empty}>{t("noData")}</div>
        )}

        {graph && edges.length === 0 && <div className={styles.empty}>{t("operationRouteNoLinks")}</div>}
      </div>
    </div>
  );
};

export default OperationRouteMap;
