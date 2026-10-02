import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { deleteWorkStickerById } from "../api";
import { printWorkStickersPdf } from "../utils/DocGenerator";

import CenterModal from "./CenterModal";
import { Icons } from "../icons/icons";
import styles from "./PrintableStickerList.module.scss";

const STATUS_META = {
  pending: { color: "#f59e0b", labelKey: "workStickerPending" },
  done: { color: "#16a34a", labelKey: "workStickerDone" },
  scrapped: { color: "#dc2626", labelKey: "workStickerSplitScrap" },
};

const fmtNum = (value) =>
  value === null || value === undefined || value === "" ? "—" : Number(value).toLocaleString("ru-RU");

// Удаление стикеров пока скрыто; вернуть — поставить true (права canDelete по-прежнему нужны).
const DELETE_ENABLED = false;

// Если во всём списке не больше стольких стикеров — группы раскрыты сразу.
const AUTO_EXPAND_MAX = 10;

// Удалять можно только невыполненное: в работе или брак (как на сервере).
const isDeletable = (sticker) => sticker.status === "pending" || sticker.status === "scrapped";

// Группы стикеров — операция и путь (дальше / исправление): название операции один
// раз на все стикеры под ним, а печать идёт отдельно по группе. Брак — отдельная
// группа "Брак": в базе у него операция шага, где его забраковали (например
// "Контроль качества"), и под этим именем он выглядел бы как обычный стикер.
// Порядок: дальше, исправление, не выполненные, брак. scrapName — подпись группы брака.
const buildGroups = (stickers, scrapName) => {
  const groups = [];
  stickers.forEach((sticker) => {
    const isScrap = sticker.status === "scrapped";
    const isRework = !isScrap && sticker.split_kind === "rework";
    const isIncomplete = !isScrap && sticker.split_kind === "incomplete";
    const path = isRework ? "rework" : isIncomplete ? "incomplete" : "next";
    const key = isScrap ? "scrap" : `${sticker.operationType?.id ?? "none"}:${path}`;
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = {
        key,
        isScrap,
        isRework,
        isIncomplete,
        name: isScrap ? scrapName : sticker.operationType?.name || "—",
        items: [],
      };
      groups.push(group);
    }
    group.items.push(sticker);
  });
  const rank = (group) => (group.isScrap ? 3 : group.isIncomplete ? 2 : group.isRework ? 1 : 0);
  groups.sort((a, b) => rank(a) - rank(b));
  return groups;
};

// Общая печать: все стикеры списка (всех операций, вместе с браком) одним заданием,
// в том же порядке, что и группы на экране. Кнопку кладёт родитель в свою шапку.
export const PrintAllButton = ({ stickers, template, className = "" }) => {
  const { t } = useTranslation();
  if (!stickers?.length) return null;

  return (
    <button
      type="button"
      className={`${styles.printAllBtn} ${className}`}
      onClick={() =>
        printWorkStickersPdf(
          buildGroups(stickers, "").flatMap((group) => group.items),
          template || undefined,
        )
      }
    >
      {Icons.print}
      <span>{t("workStickerPrintEverything")}</span>
    </button>
  );
};

// Список стикеров, созданных при распределении принятого стикера дальше, с
// печатью: сразу после "Раздать дальше" и из истории приёма. Печать — отдельно
// по каждой операции (в шапке её группы) и по одному стикеру; брак (его
// маркируют физически) — своя группа, тоже печатается. Сохранение в PDF пока
// скрыто (кнопок нет), общая печать всех операций — PrintAllButton.
// Удалить можно только стикер в работе (pending) или брак (scrapped) — сервер
// тоже не даёт удалить принятый; после удаления вызывается onDeleted(ids) —
// массив реально удалённых id (одна строка или "Удалить все").
const PrintableStickerList = ({
  stickers,
  template,
  fill = false,
  canDelete: canDeleteProp = false,
  bulkDelete = true, // false — без "Удалить все" (родитель даёт свой откат)
  onDeleted,
}) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const canDelete = DELETE_ENABLED && canDeleteProp;
  const [deleteTarget, setDeleteTarget] = useState(null); // number[] | null
  // Ручной выбор пользователя по группам (ключ → раскрыта). Пока группа не тронута,
  // работает умолчание: стикеров мало — раскрыты сразу, много — свёрнуты.
  const [manualExpanded, setManualExpanded] = useState(() => new Map());
  const autoExpand = stickers.length <= AUTO_EXPAND_MAX;
  const isExpanded = (key) => (manualExpanded.has(key) ? manualExpanded.get(key) : autoExpand);

  const toggleGroup = (key) =>
    setManualExpanded((prev) => {
      const next = new Map(prev);
      next.set(key, !(prev.has(key) ? prev.get(key) : autoExpand));
      return next;
    });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const ids = deleteTarget;
    setDeleteTarget(null);

    // allSettled: при массовом удалении один отказ не должен скрыть остальные
    // удалённые — иначе список разойдётся с базой.
    const results = await Promise.allSettled(ids.map((id) => deleteWorkStickerById(id)));
    const deleted = ids.filter((_, i) => results[i].status === "fulfilled" && results[i].value?.success);
    if (deleted.length > 0) onDeleted?.(deleted);

    if (deleted.length === ids.length) return showAlert(t("success"), "success");
    const failure = results.find((r) => r.status === "rejected");
    showAlert(failure?.reason?.response?.data?.error || t("error"), "error");
  };

  const deletableIds = stickers.filter(isDeletable).map((s) => s.id);
  // Шаблон может ещё не загрузиться (null) — генератор PDF тогда берёт дефолтный.
  const tpl = template || undefined;

  const groups = buildGroups(stickers, t("workStickerSplitScrap"));

  return (
    <div className={styles.list}>
      {bulkDelete && canDelete && deletableIds.length > 0 && (
        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            onClick={() => setDeleteTarget(deletableIds)}
          >
            {Icons.delete} {t("workStickerDeleteAll")}
          </button>
        </div>
      )}

      <div className={`${styles.rows} ${fill ? styles.rowsFill : ""}`}>
        {groups.map((group) => (
          <div className={`${styles.group} ${group.isScrap ? styles.groupScrap : ""}`} key={group.key}>
            {/* Клик по шапке (названию операции) сворачивает / раскрывает стикеры;
                клик по шеврону всплывает сюда же, кнопки печати — гасят всплытие. */}
            <div
              className={`${styles.groupHeader} ${group.isScrap ? styles.groupHeaderScrap : ""} ${isExpanded(group.key) ? "" : styles.groupHeaderCollapsed}`}
              onClick={() => toggleGroup(group.key)}
            >
              <button
                type="button"
                className={`${styles.toggleBtn} ${isExpanded(group.key) ? "" : styles.toggleBtnCollapsed}`}
                title={isExpanded(group.key) ? t("hide") : t("show")}
                aria-expanded={isExpanded(group.key)}
              >
                {Icons.chevronDown}
              </button>
              <span className={styles.groupName}>{group.name}</span>
              {group.isRework && <span className={styles.groupTag}>{t("workStickerSplitRework")}</span>}
              {group.isIncomplete && (
                <span className={`${styles.groupTag} ${styles.groupTagIncomplete}`}>
                  {t("workStickerSplitIncomplete")}
                </span>
              )}
              <span className={styles.groupCount}>{group.items.length}</span>

              {/* Печать — всех стикеров этой операции, не всего списка; кнопка
                  подписана, чтобы было понятно, что она делает. */}
              <span className={styles.groupActions} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className={`${styles.groupBtn} ${styles.groupBtnPrimary}`}
                  onClick={() => printWorkStickersPdf(group.items, tpl)}
                >
                  {Icons.print}
                  {t("workStickerPrintAll")}
                </button>
              </span>
            </div>

            {/* Стикеры — значками в сетке: при десятках и сотнях они занимают
                несколько строк, а не столбец. Кнопки всегда на виду и крупные:
                на POS-терминале нет мыши (нет hover), нажимают пальцем. */}
            <div className={styles.chips} hidden={!isExpanded(group.key)}>
              {group.items.map((sticker, index) => {
                const meta = STATUS_META[sticker.status] || STATUS_META.pending;
                return (
                  <div className={styles.chip} key={sticker.id}>
                    {/* Порядковый номер внутри операции — чтобы сверять с количеством в шапке. */}
                    <span className={styles.num}>{index + 1}</span>
                    <span className={styles.dot} style={{ background: meta.color }} title={t(meta.labelKey)} />
                    <span className={styles.code}>{sticker.sticker_code}</span>
                    <span className={styles.qty}>{fmtNum(sticker.planned_quantity)}</span>
                    <span className={`${styles.chipActions} ${canDelete ? styles.chipActionsWide : ""}`}>
                      <button
                        type="button"
                        className={`${styles.iconBtn} ${styles.iconBtnPrimary}`}
                        title={t("workStickerPrint")}
                        onClick={() => printWorkStickersPdf([sticker], tpl)}
                      >
                        {Icons.print}
                      </button>
                      {canDelete && isDeletable(sticker) && (
                        <button
                          type="button"
                          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                          title={t("delete")}
                          onClick={() => setDeleteTarget([sticker.id])}
                        >
                          {Icons.delete}
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {stickers.length === 0 && <div className={styles.empty}>{t("noData")}</div>}
      </div>

      <CenterModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onAccept={handleDelete}
        message={t("areYouSureDelete")}
      />
    </div>
  );
};

export default PrintableStickerList;
