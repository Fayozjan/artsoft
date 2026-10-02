import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trans, useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { advanceWorkSticker } from "../api";
import { fmtQty, qtyToString, sanitizeNumericInput, goodQuantity } from "../utils/quantity";

import { Icons } from "../icons/icons";
import styles from "./WorkStickerRoutePanel.module.scss";

// Верхняя граница числа стикеров при дроблении на приёме (отдельно от создания
// стикеров в распределении работы, где лимита в 200 уже нет).
const MAX_STICKERS = 200;
const QTY_STEP = 0.0001;

// Целые количества (штуки) делим целыми, дробные — с точностью до 0.0001,
// иначе на 1000 / 3 получили бы хвост в четвёртом знаке у каждого стикера.
const splitStep = (...values) => (values.every(Number.isInteger) ? 1 : QTY_STEP);

// "Кол-во на стикер" → список количеств: полные стикеры по `per` + один
// добивающий с остатком (1350 по 100 → 13×100 + 50). null — стикеров
// получилось бы больше MAX_STICKERS, такое дробление не применяем.
const splitByQuantity = (total, per) => {
  const step = splitStep(total, per);
  const totalUnits = Math.round(total / step);
  const perUnits = Math.max(Math.round(per / step), 1);
  const full = Math.floor(totalUnits / perUnits);
  const rest = totalUnits - full * perUnits;
  if (full + (rest > 0 ? 1 : 0) > MAX_STICKERS) return null;

  const rows = Array(full).fill(qtyToString(perUnits * step));
  if (rest > 0) rows.push(qtyToString(rest * step));
  return rows;
};

// "Кол-во стикеров" → максимально ровное деление на `count` частей, лишние
// единицы уходят первым стикерам (1350 на 4 → 338, 338, 337, 337).
const splitByCount = (total, count) => {
  const step = splitStep(total);
  const totalUnits = Math.round(total / step);
  const n = Math.max(1, Math.min(Math.floor(count), MAX_STICKERS, totalUnits));
  const base = Math.floor(totalUnits / n);
  const extra = totalUnits - base * n;
  return Array.from({ length: n }, (_, i) => qtyToString((base + (i < extra ? 1 : 0)) * step));
};

// Калькуляция компактно: одинаковые количества подряд сворачиваем в одну плашку
// (13 стикеров по 100 и один на 50 → "13 × 100", "1 × 50").
const groupSplits = (quantities) => {
  const groups = [];
  quantities.forEach((quantity) => {
    const last = groups[groups.length - 1];
    if (last && last.quantity === quantity) last.count += 1;
    else groups.push({ quantity, count: 1 });
  });
  return groups;
};

// Есть что раздавать или создавать: годное (у последней операции — только если у
// типа задана операция исправления), количество на исправление, не выполненное
// или брак — стикер брака создаётся при раздаче.
export const canDistribute = (sticker) => {
  const type = sticker.operationType;
  const canRoute = !type?.is_final || (type?.reworkOperations || []).length > 0;
  return (
    (canRoute && goodQuantity(sticker) > 0) ||
    Number(sticker.rework_quantity) > 0 ||
    Number(sticker.incomplete_quantity) > 0 ||
    Number(sticker.defect_quantity) > 0
  );
};

// Итог приёма: полоска долей и строки выполнено / брак / на исправление / не
// выполнено (последние три — если были).
export const AcceptedSummary = ({ sticker }) => {
  const { t } = useTranslation();

  const items = [
    { key: "done", tone: styles.toneGood, label: t("workStickerActualQuantity"), value: goodQuantity(sticker), always: true },
    { key: "defect", tone: styles.toneBad, label: t("workStickerDefectQuantity"), value: sticker.defect_quantity },
    { key: "rework", tone: styles.toneWarn, label: t("workStickerReworkQuantity"), value: sticker.rework_quantity },
    {
      key: "incomplete",
      tone: styles.toneInfo,
      label: t("workStickerIncompleteQuantity"),
      value: sticker.incomplete_quantity,
    },
  ].filter((item) => item.always || Number(item.value) > 0);
  const sum = items.reduce((total, item) => total + (Number(item.value) || 0), 0);

  return (
    <div className={styles.summary}>
      <div className={styles.summaryBar} aria-hidden="true">
        {items.map((item) => (
          <span
            key={item.key}
            className={`${styles.summarySeg} ${item.tone}`}
            style={{ width: `${sum > 0 ? ((Number(item.value) || 0) / sum) * 100 : 0}%` }}
          />
        ))}
      </div>

      <ul className={styles.summaryList}>
        {items.map((item) => (
          <li key={item.key} className={item.tone}>
            <i className={styles.summaryDot} />
            <span>{item.label}</span>
            <b>{fmtQty(item.value || 0)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
};

// Настроенные у типа варианты следующей операции (см. AddOperationType — поле
// "Следующие операции по умолчанию"). Заданная у типа остаётся доступной, даже
// если её потом отключили.
export const nextOperationCandidates = (type) =>
  (type?.nextOperations || []).map((rel) => rel.nextOperationType).filter(Boolean);

// То же для операции исправления: настроен у типа хотя бы один вариант —
// приёмщик выбирает среди них (см. AddOperationType — поле "Операция для
// исправления", мультивыбор).
export const reworkOperationCandidates = (type) =>
  (type?.reworkOperations || []).map((rel) => rel.reworkOperationType).filter(Boolean);

// Настроенные у типа варианты операции для не выполненных (см. AddOperationType —
// поле "Операция для не выполненных", мультивыбор). Не разрешены у типа — вариантов нет.
export const incompleteOperationCandidates = (type) =>
  type?.allow_incomplete
    ? (type?.incompleteOperations || []).map((rel) => rel.incompleteOperationType).filter(Boolean)
    : [];

// Операции для выбора следующей: настроен у типа хотя бы один вариант — только
// они; не настроено ни одного — прежнее поведение: все активные, кроме исправления
// и первой операции (та, с которой партия начинается после прихода, — "следующей"
// быть не может).
export const nextOperationOptions = (operationTypes, candidates) =>
  candidates.length > 0 ? candidates : operationTypes.filter((type) => !type.is_rework && !type.is_first);

// Операции для выбора исправления — так же: настроен у типа хотя бы один
// вариант — только они; не настроено ни одного — прежнее поведение: все активные,
// помеченные как исправление.
export const reworkOperationOptions = (operationTypes, candidates) =>
  candidates.length > 0 ? candidates : operationTypes.filter((type) => type.is_rework);

// Операции для выбора для не выполненных — так же: настроен у типа хотя бы один
// вариант — только они; не настроено ни одного — любая активная обычная операция
// (не исправление).
export const incompleteOperationOptions = (operationTypes, candidates) =>
  candidates.length > 0 ? candidates : operationTypes.filter((type) => !type.is_rework);

// Единственный вариант выбирается сам — выбирать не из чего.
const soleOptionId = (options) => (options.length === 1 ? String(options[0].id) : "");

// Выбор операции крупными плитками: выбрана всегда одна, повторный клик выбор не
// снимает — случайно "сбросить" операцию нельзя. `extra` — ещё одна плитка в том же
// ряду, не операция ("Объединить с другими"): выбрана она — операции не выбраны.
export const OperationChoice = ({ options, value, onChange, label, extra }) => (
  <div className={styles.choices} role="radiogroup" aria-label={label}>
    {options.map((option) => {
      const selected = !extra?.selected && String(option.id) === value;
      return (
        <button
          key={option.id}
          type="button"
          role="radio"
          aria-checked={selected}
          className={`${styles.choice} ${selected ? styles.choiceActive : ""}`}
          onClick={() => onChange(String(option.id))}
        >
          <span className={styles.choiceName}>{option.name}</span>
          <span className={styles.choiceMark}>{Icons.check}</span>
        </button>
      );
    })}
    {extra && (
      <button
        type="button"
        role="radio"
        aria-checked={extra.selected}
        className={`${styles.choice} ${extra.selected ? styles.choiceActive : ""}`}
        onClick={extra.onSelect}
      >
        <span className={styles.choiceName}>{extra.label}</span>
        <span className={styles.choiceMark}>{Icons.check}</span>
      </button>
    )}
  </div>
);

// Шапка карточки направления: номер шага (или значок), название с пояснением и
// справа — сколько уходит по этому направлению, с подписью.
export const SectionHead = ({ badge, title, hint, qty, qtyLabel, qtyClassName }) => (
  <div className={styles.sectionHead}>
    <span className={styles.sectionBadge}>{badge}</span>
    <div className={styles.sectionTexts}>
      <span className={styles.sectionTitle}>{title}</span>
      {hint && <span className={styles.sectionHint}>{hint}</span>}
    </div>
    <div className={qtyClassName ? `${styles.sectionQty} ${qtyClassName}` : styles.sectionQty}>
      <b>{fmtQty(qty)}</b>
      <span>{qtyLabel}</span>
    </div>
  </div>
);

// Что делать с принятым стикером дальше. Сделано для тех, кто не дружит с техникой:
// выбор крупными плитками (одна выбрана всегда); по умолчанию всё выполненное
// уходит одним стикером, а дробление спрятано за кнопкой. Брак получает свой
// стикер сам, на экране не показывается. Следующая операция, операция для
// исправления и операция для не выполненных — одинаково: один вариант настроен у типа — подставляется сам;
// несколько — выбор среди них; не настроено ни одного — можно выбрать любую
// активную (см. nextOperationOptions / reworkOperationOptions). Плитки исправления
// показываются, только если при приёме указано количество на исправление; плитки
// не выполненных — только если указано не выполненное количество.
const WorkStickerRoutePanel = ({
  sticker,
  operationTypes,
  busy,
  onAdvanced,
  onBack,
  onCancelAwaitingMerge,
  // Закреплённый низ страницы (Telegram): подвал с «Раздать дальше» уходит порталом
  // туда и всегда виден внизу экрана на сплошном фоне. Нет узла — подвал внутри панели.
  dockNode,
}) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const type = sticker.operationType;
  const canPickNext = !type?.is_final;
  // Выполнено всего — по всем сотрудникам, принявшим этот стикер.
  const total = goodQuantity(sticker);
  const defect = Number(sticker.defect_quantity) || 0;
  const rework = Number(sticker.rework_quantity) || 0;
  const incomplete = Number(sticker.incomplete_quantity) || 0;
  const hasGood = total > 0;

  const nextCandidates = nextOperationCandidates(type);
  const nextOptions = nextOperationOptions(operationTypes, nextCandidates);
  const reworkCandidates = reworkOperationCandidates(type);
  const reworkOptions = reworkOperationOptions(operationTypes, reworkCandidates);
  const incompleteCandidates = incompleteOperationCandidates(type);
  const incompleteOptions = incompleteOperationOptions(operationTypes, incompleteCandidates);

  // Настроен ровно один вариант — он же подставляется сам; несколько — выбора по
  // умолчанию нет, приёмщик выбирает среди них (см. OperationChoice ниже).
  const defaultNextId = nextCandidates.length === 1 ? String(nextCandidates[0].id) : "";
  const defaultReworkId = reworkCandidates.length === 1 ? String(reworkCandidates[0].id) : "";
  const defaultIncompleteId = incompleteCandidates.length === 1 ? String(incompleteCandidates[0].id) : "";
  // Выбор приёмщика; пусто — не трогал.
  const [nextTypeId, setNextTypeId] = useState("");
  const [reworkTypeId, setReworkTypeId] = useState("");
  const [incompleteTypeId, setIncompleteTypeId] = useState("");
  // Итоговая операция: выбор приёмщика, иначе заданная у типа, иначе единственный
  // вариант. Каждую сверяем со списком для выбора (см. nextOperationOptions /
  // reworkOperationOptions) — так скрытая операция (первая, исправление) не уйдёт
  // на сервер. Список операций приходит позже панели, поэтому считаем на лету, а
  // не в начальном состоянии.
  const isPickable = (id) => nextOptions.some((option) => String(option.id) === id);
  const nextId = canPickNext ? [nextTypeId, defaultNextId].find(isPickable) ?? soleOptionId(nextOptions) : "";
  // "Объединить с другими" — плитка выбора рядом со следующими операциями (у типа
  // разрешено объединение). Выбрана — годное не раздаётся, а ждёт объединения; брак,
  // исправление и не выполненное раздаются как обычно.
  const [mergeChosen, setMergeChosen] = useState(false);
  const isReworkPickable = (id) => reworkOptions.some((option) => String(option.id) === id);
  const reworkId = [reworkTypeId, defaultReworkId].find(isReworkPickable) ?? soleOptionId(reworkOptions);
  const isIncompletePickable = (id) => incompleteOptions.some((option) => String(option.id) === id);
  const incompleteId =
    [incompleteTypeId, defaultIncompleteId].find(isIncompletePickable) ?? soleOptionId(incompleteOptions);

  // Стикеры следующей операции: по умолчанию один на всё выполненное, дробление
  // включается кнопкой и вводом "кол-во на стикер" / "кол-во стикеров".
  const [splitting, setSplitting] = useState(false);
  const [nextSplits, setNextSplits] = useState(hasGood ? [qtyToString(total)] : []);
  const [perSticker, setPerSticker] = useState(hasGood ? qtyToString(total) : "");
  const [stickerCount, setStickerCount] = useState(hasGood ? "1" : "");
  const [saving, setSaving] = useState(false);
  // Нажали "Раздать дальше", а что-то не выбрано — подсвечиваем такой шаг.
  const [attempted, setAttempted] = useState(false);
  const nextRef = useRef(null);
  const reworkRef = useRef(null);
  const incompleteRef = useRef(null);

  // Максимум стикеров — по одной штуке на стикер (но не больше лимита).
  const maxCount = Math.min(MAX_STICKERS, Math.round(total / splitStep(total)));

  // Раздача заблокирована, пока не выбрана следующая операция (если есть выполненное
  // и тип не последний) — иначе часть изделий осталась бы без стикера. То же, если
  // есть количество на исправление: у типа не настроено ни одной операции —
  // сервер раздачу не примет; настроено несколько — приёмщик должен выбрать одну.
  const showNext = hasGood && canPickNext;
  const showRework = rework > 0;
  const mergeAvailable = showNext && Boolean(type?.allow_merge);
  const merging = mergeAvailable && mergeChosen;
  const needNextOp = showNext && !nextId && !merging;
  const reworkNotConfigured = showRework && reworkOptions.length === 0;
  const reworkUnselected = showRework && reworkOptions.length > 0 && !reworkId;
  const reworkMissing = reworkNotConfigured || reworkUnselected;
  const nextCreates = showNext && Boolean(nextId) && !merging;
  const reworkCreates = showRework && Boolean(reworkId);

  // Не выполненное — так же, как исправление: выбранной операции нет (нет активных
  // операций либо приёмщик не выбрал одну из нескольких) — раздача заблокирована.
  const showIncomplete = incomplete > 0;
  const incompleteNotConfigured = showIncomplete && incompleteOptions.length === 0;
  const incompleteUnselected = showIncomplete && incompleteOptions.length > 0 && !incompleteId;
  const incompleteMissing = incompleteNotConfigured || incompleteUnselected;
  const incompleteCreates = showIncomplete && Boolean(incompleteId);

  // Дробление: не введено количество на стикер или стикеров вышло бы больше
  // лимита — иначе раздали бы не то, что показано на экране.
  const perNum = Number(perSticker);
  const tooMany = splitting && perNum > 0 && splitByQuantity(total, perNum) === null;
  const splitBlocked = nextCreates && splitting && (tooMany || !(perNum > 0));

  const canSubmit =
    !needNextOp &&
    !reworkMissing &&
    !incompleteMissing &&
    !splitBlocked &&
    (nextCreates || reworkCreates || incompleteCreates || defect > 0 || merging);

  // Что именно не так — перечисляем всё, а не только первое.
  const hint = [
    needNextOp && t("workStickerSelectNextOperation"),
    reworkNotConfigured && t("workStickerReworkNotConfigured"),
    reworkUnselected && t("workStickerSelectReworkOperation"),
    incompleteNotConfigured && t("workStickerNoIncompleteOperations"),
    incompleteUnselected && t("workStickerSelectIncompleteOperation"),
    splitBlocked && (tooMany ? t("workStickerSplitTooMany", { max: MAX_STICKERS }) : t("workStickerSplitEnter")),
  ]
    .filter(Boolean)
    .join(" · ");

  // Сколько стикеров создастся: следующая операция, исправление (один), не
  // выполненное (один) и брак (один).
  const stickersToCreate =
    (nextCreates ? nextSplits.filter((quantity) => Number(quantity) > 0).length : 0) +
    (reworkCreates ? 1 : 0) +
    (incompleteCreates ? 1 : 0) +
    (defect > 0 ? 1 : 0);

  const applyNextSplits = (quantities) => {
    setNextSplits(quantities);
    setStickerCount(quantities.length > 0 ? String(quantities.length) : "");
  };

  // Ввели "кол-во на стикер" → считаем сколько стикеров выйдет (последний
  // берёт остаток) и сразу раскладываем выполненное по пачкам.
  const handlePerStickerChange = (raw) => {
    let value = sanitizeNumericInput(raw);
    // На один стикер больше выполненного не бывает.
    if (Number(value) > total) value = qtyToString(total);
    setPerSticker(value);
    const per = Number(value);
    if (!(per > 0) || total <= 0) return;

    const quantities = splitByQuantity(total, per);
    if (quantities) applyNextSplits(quantities);
  };

  // Ввели "кол-во стикеров" → делим выполненное поровну, "на стикер" подставляется само.
  const handleStickerCountChange = (raw) => {
    const value = raw.replace(/\D/g, "");
    setStickerCount(value);
    const count = Number(value);
    if (!(count >= 1) || total <= 0) return;

    const quantities = splitByCount(total, count);
    setNextSplits(quantities);
    setPerSticker(quantities[0]);
    // Ввели больше, чем можно, — показываем предел, а не введённое.
    if (String(quantities.length) !== value) setStickerCount(String(quantities.length));
  };

  const stepCount = (delta) => {
    const current = Number(stickerCount) || nextSplits.length || 1;
    handleStickerCountChange(String(Math.min(Math.max(current + delta, 1), maxCount)));
  };

  // "Не делить": обратно к одному стикеру на всё выполненное.
  const closeSplit = () => {
    setSplitting(false);
    setPerSticker(hasGood ? qtyToString(total) : "");
    applyNextSplits(hasGood ? [qtyToString(total)] : []);
  };

  const submit = async () => {
    if (saving || busy) return;
    // Кнопка не disabled, иначе клик молча ничего не делает: по клику говорим,
    // что именно не выбрано, и подводим к этому шагу.
    if (hint) {
      setAttempted(true);
      const target = needNextOp
        ? nextRef
        : reworkUnselected
          ? reworkRef
          : incompleteMissing
            ? incompleteRef
            : nextRef;
      target.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return showAlert(hint, "error");
    }
    if (!canSubmit) return;

    setSaving(true);
    try {
      const res = await advanceWorkSticker(sticker.sticker_code, {
        next_operation_type_id: merging ? "" : nextId,
        rework_operation_type_id: reworkId,
        // Не выполненного нет — операцию не шлём (у типа без allow_incomplete сервер её отклонит).
        incomplete_operation_type_id: showIncomplete ? incompleteId : "",
        // Годное ждёт объединения — следующей операции и стикеров на неё нет.
        await_merge: merging,
        splits: [
          ...(hasGood && !merging
            ? nextSplits.filter((quantity) => Number(quantity) > 0).map((quantity) => ({ kind: "next", quantity }))
            : []),
          ...(rework > 0 ? [{ kind: "rework", quantity: qtyToString(rework) }] : []),
          ...(incomplete > 0 ? [{ kind: "incomplete", quantity: qtyToString(incomplete) }] : []),
        ],
      });
      if (!res?.success) throw new Error(res?.error || t("error"));

      showAlert(t("success"), "success");
      onAdvanced(res.data || [], { awaitMerge: merging });
    } catch (err) {
      showAlert(err?.response?.data?.error || err.message || t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const missingClass = (missing) => (attempted && missing ? styles.sectionMissing : "");

  // Отмечен для объединения — вместо обычного распределения только статус и
  // снятие отметки; "Раздать дальше" для этого стикера недоступна (см.
  // assertNotAwaitingMerge на сервере).
  if (sticker.awaiting_merge) {
    return (
      <div className={styles.panel}>
        <div className={styles.panelHead}>
          <div className={styles.panelTitle}>{t("workStickerDistributionTitle")}</div>
        </div>
        <div className={styles.awaitingMerge}>
          <span className={styles.awaitingMergeDot} />
          <div className={styles.awaitingMergeTexts}>
            <b>{t("workStickerAwaitingMergeTitle")}</b>
            <span>{t("workStickerAwaitingMergeHint")}</span>
          </div>
          <button type="button" className={styles.ghostBtn} onClick={onCancelAwaitingMerge}>
            {t("workStickerAwaitingMergeCancel")}
          </button>
        </div>
      </div>
    );
  }

  const footer = (
    <div className={`${styles.footer} ${dockNode ? styles.footerDocked : ""}`}>
      <span className={`${styles.footerText} ${hint ? styles.footerWarn : ""}`}>
        {hint ||
          (merging && stickersToCreate === 0
            ? t("workStickerMergeWillWait")
            : t("workStickerWillCreate", { n: stickersToCreate }))}
      </span>
      <div className={styles.footerActions}>
        {/* Назад к приёму: откат приёма — снова выбор сотрудника, брак и исправление. */}
        {onBack && (
          <button type="button" className={styles.backBtn} disabled={busy || saving} onClick={onBack}>
            <span className={styles.backArrow}>{Icons.arrowBack}</span>
            <span>{t("back")}</span>
          </button>
        )}
        <button
          type="button"
          className={`${styles.submit} ${hint ? styles.submitIncomplete : ""}`}
          disabled={busy || saving}
          onClick={submit}
        >
          <span>{saving ? t("loading") : t("workStickerAdvance")}</span>
          {!saving && <span className={styles.submitArrow}>{Icons.arrowForward}</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <div className={styles.panelTitle}>{t("workStickerDistributionTitle")}</div>
        {/* Выбирать нечего (нет годного или последняя операция) — так и говорим. */}
        <div className={styles.panelSubtitle}>
          {t(showNext ? "workStickerRouteSubtitle" : "workStickerRouteAuto")}
        </div>
      </div>

      {showNext && (
        <section
          ref={nextRef}
          className={`${styles.section} ${styles.sectionNext} ${missingClass(needNextOp || splitBlocked)}`}
        >
          <SectionHead
            badge={Icons.arrowForward}
            title={t("workStickerNextOperation")}
            hint={t("workStickerNextHint")}
            qty={total}
            qtyLabel={t("workStickerActualQuantity")}
          />

          {nextOptions.length > 0 || mergeAvailable ? (
            <OperationChoice
              options={nextOptions}
              value={nextId}
              onChange={(id) => {
                setMergeChosen(false);
                setNextTypeId(id);
              }}
              label={t("workStickerNextOperation")}
              extra={
                mergeAvailable
                  ? { label: t("workStickerMergeInstead"), selected: merging, onSelect: () => setMergeChosen(true) }
                  : undefined
              }
            />
          ) : (
            <p className={styles.sectionNote}>{t("workStickerNoNextOperations")}</p>
          )}
          {attempted && needNextOp && (nextOptions.length > 0 || mergeAvailable) && (
            <div className={styles.prompt}>{t("workStickerSelectNextOperation")}</div>
          )}

          {/* Выбрано объединение: стикер на следующую операцию не создаётся, годное
              ждёт объединения с другими — а стикеры брака/исправления/не выполненного
              ниже печатаются сейчас. */}
          {merging && (
            <div className={styles.oneSticker}>
              <span className={styles.oneStickerText}>{t("workStickerMergeChosenHint")}</span>
            </div>
          )}

          {nextId &&
            !merging &&
            (splitting ? (
              <div className={styles.splitPanel}>
                <div className={styles.splitFields}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="route-per-sticker">
                      {t("workStickerSplitPer")}
                    </label>
                    <input
                      id="route-per-sticker"
                      type="text"
                      inputMode="decimal"
                      className={`${styles.bigInput} ${tooMany || !(perNum > 0) ? styles.bigInputError : ""}`}
                      value={perSticker}
                      onChange={(e) => handlePerStickerChange(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onBlur={() => {
                        if (!(Number(perSticker) > 0)) setPerSticker(nextSplits[0] || qtyToString(total));
                      }}
                    />
                  </div>

                  <div className={styles.field}>
                    <label className={styles.fieldLabel} htmlFor="route-sticker-count">
                      {t("workStickerSplitCount")}
                    </label>
                    <div className={styles.stepper}>
                      <button
                        type="button"
                        className={styles.stepBtn}
                        aria-label={`${t("workStickerSplitCount")} −`}
                        disabled={(Number(stickerCount) || 1) <= 1}
                        onClick={() => stepCount(-1)}
                      >
                        −
                      </button>
                      <input
                        id="route-sticker-count"
                        type="text"
                        inputMode="numeric"
                        className={styles.bigInput}
                        value={stickerCount}
                        onChange={(e) => handleStickerCountChange(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        onBlur={() => setStickerCount(String(nextSplits.length))}
                      />
                      <button
                        type="button"
                        className={styles.stepBtn}
                        aria-label={`${t("workStickerSplitCount")} +`}
                        disabled={(Number(stickerCount) || 1) >= maxCount}
                        onClick={() => stepCount(1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Калькуляция слева, "Не делить" справа — в одной строке (не влезают — кнопка
                    переносится вниз, но остаётся справа). */}
                <div className={styles.splitFooter}>
                  {tooMany ? (
                    <div className={styles.fieldError}>{t("workStickerSplitTooMany", { max: MAX_STICKERS })}</div>
                  ) : (
                    // Калькуляция словами: "99 стикеров по 50 шт." и "1 стикер на 20 шт." —
                    // одна плашка на группу одинаковых стикеров (число в слове склоняется по count).
                    <div className={styles.splitResult}>
                      <span>{t("workStickerSplitResult")}:</span>
                      <div className={styles.splitChips}>
                        {groupSplits(nextSplits).map((group, index) => (
                          <span className={`${styles.splitChip} ${styles.splitChipText}`} key={index}>
                            <Trans
                              i18nKey={group.count === 1 ? "workStickerSplitLineSingle" : "workStickerSplitLine"}
                              count={group.count}
                              values={{ qty: fmtQty(group.quantity) }}
                              components={{ b: <b /> }}
                            />
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <button type="button" className={`${styles.ghostBtn} ${styles.splitCloseBtn}`} onClick={closeSplit}>
                    {t("workStickerSplitClose")}
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.oneSticker}>
                <span className={styles.oneStickerText}>{t("workStickerOneSticker")}</span>
                <div className={styles.oneStickerActions}>
                  {maxCount > 1 && (
                    <button type="button" className={styles.ghostBtn} onClick={() => setSplitting(true)}>
                      {t("workStickerSplitOpen")}
                    </button>
                  )}
                </div>
              </div>
            ))}
        </section>
      )}

      {showRework && (
        <section
          ref={reworkRef}
          className={`${styles.section} ${styles.sectionRework} ${missingClass(reworkMissing)}`}
        >
          <SectionHead
            badge={Icons.arrowBack}
            title={t("workStickerReworkOperation")}
            hint={t("workStickerReworkHint")}
            qty={rework}
            qtyLabel={t("workStickerReworkQuantity")}
          />

          {reworkOptions.length > 0 ? (
            <OperationChoice
              options={reworkOptions}
              value={reworkId}
              onChange={setReworkTypeId}
              label={t("workStickerReworkOperation")}
            />
          ) : (
            <p className={styles.sectionNote}>{t("workStickerNoReworkOperations")}</p>
          )}
          {attempted && reworkUnselected && (
            <div className={styles.prompt}>{t("workStickerSelectReworkOperation")}</div>
          )}

        </section>
      )}

      {showIncomplete && (
        <section
          ref={incompleteRef}
          className={`${styles.section} ${styles.sectionIncomplete} ${missingClass(incompleteMissing)}`}
        >
          <SectionHead
            badge={Icons.arrowForward}
            title={t("workStickerIncompleteOperation")}
            hint={t("workStickerIncompleteHint")}
            qty={incomplete}
            qtyLabel={t("workStickerIncompleteQuantity")}
          />

          {incompleteOptions.length > 0 ? (
            <OperationChoice
              options={incompleteOptions}
              value={incompleteId}
              onChange={setIncompleteTypeId}
              label={t("workStickerIncompleteOperation")}
            />
          ) : (
            <p className={styles.sectionNote}>{t("workStickerNoIncompleteOperations")}</p>
          )}
          {attempted && incompleteUnselected && (
            <div className={styles.prompt}>{t("workStickerSelectIncompleteOperation")}</div>
          )}
        </section>
      )}

      {dockNode ? createPortal(footer, dockNode) : footer}
    </div>
  );
};

export default WorkStickerRoutePanel;
