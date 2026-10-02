import { forwardRef, useImperativeHandle, useState, useEffect, useCallback, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";
import { ListChecks } from "lucide-react";

import { useAlertStore } from "../stores/alertStore";
import { useProductionAccess } from "../hooks/useProductionAccess";
import {
  getActiveOperationTypes,
  getWorkStickers,
  addWorkStickers,
  deleteWorkStickerById,
  getWorkStickerTemplates,
  createWorkStickerTemplate,
  updateWorkStickerTemplate,
  activateWorkStickerTemplate,
  deleteWorkStickerTemplate,
} from "../api";
import { printWorkStickersPdf } from "../utils/DocGenerator";
import { userDisplayName } from "../utils/userDisplayName";
import { fmtQty, qtyToString, sanitizeNumericInput } from "../utils/quantity";

import Loading from "./Loading";
import CenterModal from "./CenterModal";
import OverlaySidebar from "./OverlaySidebar";
import StickerTemplateEditor from "./StickerTemplateEditor";
import BatchItemCard, { BatchItemGrid } from "./BatchItemCard";
import StatusFilterSelect from "./StatusFilterSelect";
import { OperationChoice, SectionHead } from "./WorkStickerRoutePanel";

import { Icons } from "../icons/icons";
import styles from "./WorkDistributionPanel.module.scss";
// Распределение выглядит так же, как после приёма работы (WorkStickerRoutePanel).
import routeStyles from "./WorkStickerRoutePanel.module.scss";

const STICKER_STATUS_META = {
  pending: { color: "#f59e0b", labelKey: "workStickerPending" },
  done: { color: "#16a34a", labelKey: "workStickerDone" },
  scrapped: { color: "#dc2626", labelKey: "workStickerSplitScrap" },
};

const getStatusMeta = (status) => STICKER_STATUS_META[status] || Object.values(STICKER_STATUS_META)[0];

const formatDate = (dateStr) => (dateStr ? new Date(dateStr).toLocaleDateString("ru-RU") : "—");

const fmtNum = (value) => (value === null || value === undefined || value === "" ? "—" : Number(value).toLocaleString("ru-RU"));

// Количество на стикере дробное (до 4 знаков) — округляем суммы, чтобы не ловить хвосты float.
const round4 = (value) => Math.round(value * 10000) / 10000;

// planned_quantity / count: null — не вводилось, по умолчанию подставляется максимум.
const EMPTY_FORM = { planned_quantity: null, count: null, comment: "" };

// Распределение работы по принятой партии: позиции → операции → печать стикеров.
// Используется только внутри карточки партии (Приход партии): панель не рисует
// свою шапку — заголовок с "Назад", количеством позиции и шестерёнкой рисует карточка
// партии, управляя панелью через ref (`back`, `refresh`, `openTemplateEditor`) и получая в
// `onItemChange` открытую позицию `{ label, quantity }` (null — открыт список позиций).
// Печать стикеров живёт внутри операции: тип операции задаёт раскрытая группа.
// Каждая операция проходит позицию целиком, поэтому количество / напечатано / остаток
// считаются отдельно по каждой операции (так же, как лимит на сервере).
const WorkDistributionPanel = forwardRef(({ batch, canAdd, canDelete, onItemChange }, ref) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const items = batch.items || [];

  const [view, setView] = useState("items"); // "items" | "item"

  const [item, setItem] = useState(null);
  const { canEditSticker, filterOperationTypes } = useProductionAccess();
  const [distributableTypes, setDistributableTypes] = useState([]);
  // Операции для исправления в распределении партии не показываем: работа
  // уходит на них только при приёме (через исправление), а не из партии.
  // Есть первая операция после прихода партии — показываем только её; не задана
  // ни одна — все, иначе распределять было бы нечем. Список режется по правам
  // логина (доступные операции задаёт администратор).
  const operationTypes = useMemo(() => {
    const types = filterOperationTypes(distributableTypes);
    const first = types.filter((op) => op.is_first);
    return first.length > 0 ? first : types;
  }, [distributableTypes, filterOperationTypes]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [itemStickers, setItemStickers] = useState([]);
  const [loadingStickers, setLoadingStickers] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [groupStatusFilters, setGroupStatusFilters] = useState({});
  const [openGroup, setOpenGroup] = useState(null);
  // Операция, выбранная в блоке "Добавить стикер": под чипами открывается панель
  // с количеством, стикеры создаются только по кнопке "Добавить".
  const [selectedOperationId, setSelectedOperationId] = useState(null);
  // По умолчанию на всё количество один стикер; дробление открывается кнопкой.
  const [splitting, setSplitting] = useState(false);

  // Варианты внешнего вида/размера стикера — общие на компанию, правятся через
  // шестерёнку в углу панели печати. Печатается активный; редактируемый
  // (editingTemplateId) может быть любым — null значит "активный".
  const [templates, setTemplates] = useState([]);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const stickerTemplate = useMemo(
    () => templates.find((tpl) => tpl.is_active) || templates[0] || null,
    [templates],
  );
  const editingTemplate = templates.find((tpl) => tpl.id === editingTemplateId) || stickerTemplate;

  useEffect(() => {
    getActiveOperationTypes()
      .then((res) => setDistributableTypes((res.data || []).filter((op) => !op.is_rework)))
      .catch((err) => console.error(err));
    getWorkStickerTemplates()
      .then((res) => setTemplates(res.data || []))
      .catch((err) => console.error(err));
  }, []);

  // silent — ручное обновление: список не подменяется лоадером, ошибка показывается алертом.
  const loadItemStickers = useCallback(async (itemId, silent = false) => {
    if (!silent) setLoadingStickers(true);
    try {
      // Стикер может печататься на каждую штуку — тысячи на позицию, поэтому
      // грузим все, а не первую сотню (иначе после создания их не перепечатать).
      const { data } = await getWorkStickers({
        pageSize: 50000,
        filters: { batch_receipt_item_id: itemId },
      });
      setItemStickers(data || []);
    } catch (err) {
      console.error(err);
      if (silent) showAlert(t("error"), "error");
    } finally {
      if (!silent) setLoadingStickers(false);
    }
  }, [showAlert, t]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setSplitting(false);
  };

  const handleOpenItem = (it) => {
    setItem(it);
    resetForm();
    setItemStickers([]);
    // Первая операция после прихода партии выбрана заранее (нет такой — ничего не выбрано).
    setSelectedOperationId(operationTypes.find((op) => op.is_first)?.id ?? null);
    loadItemStickers(it.id);
    setView("item");
  };

  const handleBackToItems = () => {
    setView("items");
    setItem(null);
    setTemplateEditorOpen(false);
  };

  // Сколько напечатано по каждой операции позиции (ключ — id операции или "none").
  const printedByOperation = useMemo(() => {
    const map = new Map();
    itemStickers.forEach((s) => {
      // Стикер брака — те же штуки, что уже учтены в стикере, где их забраковали
      // (как в WorkStickerModel.sumPlannedByItem).
      if (s.split_kind === "scrap") return;
      const key = s.operationType?.id ?? "none";
      map.set(key, (map.get(key) || 0) + (Number(s.planned_quantity) || 0));
    });
    return map;
  }, [itemStickers]);

  const itemQuantity = Number(item?.quantity) || 0;

  const getOperationStats = (key) => {
    const distributed = round4(printedByOperation.get(key) || 0);
    return { quantity: itemQuantity, distributed, remaining: Math.max(round4(itemQuantity - distributed), 0) };
  };

  // Движение количества по операциям позиции (для шапки операции): сколько пришло на
  // операцию, сколько роздано с неё на следующую, сколько ушло в брак / на исправление /
  // в «не выполнено» и сколько осталось на ней.
  // Пришло: на первую операцию (есть стикеры, напечатанные из партии) — всё количество
  // позиции, на остальные — то, что раздали им предыдущие (сумма их стикеров).
  // Передано дальше: годное, ушедшее на следующую операцию (дети split_kind = normal);
  // при объединении у результата нет родителя — его источники помечены merged_into_id.
  // Брак / исправление / не выполнено — то, что указали при приёме стикеров операции;
  // уходят с неё (исправление и не выполненное — приход другой операции, брак — выбытие).
  // Стикеры брака (split_kind = scrap) не считаем: это те же штуки, что уже в браке.
  const routeByOperation = useMemo(() => {
    const keyOf = (s) => s.operationType?.id ?? "none";
    const keyById = new Map(itemStickers.map((s) => [s.id, keyOf(s)]));
    const mergedSourceKey = new Map();
    itemStickers.forEach((s) => {
      if (s.merged_into_id) mergedSourceKey.set(s.merged_into_id, keyOf(s));
    });

    const map = new Map();
    const statOf = (key) => {
      if (!map.has(key)) {
        map.set(key, { arrived: 0, fromItem: false, passed: 0, defect: 0, rework: 0, incomplete: 0 });
      }
      return map.get(key);
    };

    itemStickers.forEach((s) => {
      if (s.share_of_id || s.split_kind === "scrap") return;
      const planned = Number(s.planned_quantity) || 0;
      const stat = statOf(keyOf(s));
      stat.arrived += planned;
      if (s.split_kind === null) stat.fromItem = true;

      if (s.status === "done") {
        stat.defect += Number(s.defect_quantity) || 0;
        stat.rework += Number(s.rework_quantity) || 0;
        stat.incomplete += Number(s.incomplete_quantity) || 0;
      }

      if (s.split_kind === "normal") {
        const sourceKey = s.parent_sticker_id ? keyById.get(s.parent_sticker_id) : mergedSourceKey.get(s.id);
        if (sourceKey !== undefined) statOf(sourceKey).passed += planned;
      }
    });

    map.forEach((stat) => {
      stat.came = round4(stat.fromItem ? itemQuantity : stat.arrived);
      stat.passed = round4(stat.passed);
      stat.defect = round4(stat.defect);
      stat.rework = round4(stat.rework);
      stat.incomplete = round4(stat.incomplete);
      stat.left = Math.max(round4(stat.came - stat.passed - stat.defect - stat.rework - stat.incomplete), 0);
    });
    return map;
  }, [itemStickers, itemQuantity]);

  // Есть ли у позиции уже операции (напечатанные стикеры). Пока нет — распределение
  // работы создаётся вверху страницы (выбор первой операции). Дальше операции не
  // создаются отсюда, а распределение остатка идёт внутри самой операции.
  const hasOperations = itemStickers.length > 0;

  // Панель распределения вверху страницы: операций ещё нет, можно выбрать первую.
  // Пока она на экране, блок "Операции" пуст и не нужен — прячем его.
  const showTopPanel = canAdd && operationTypes.length > 0 && !hasOperations && !loadingStickers;

  // Операция, для которой сейчас открыта форма распределения: выбранный чип вверху
  // или раскрытая группа (пока в позиции есть операции).
  const formOperationId = hasOperations
    ? openGroup !== null && openGroup !== "none"
      ? openGroup
      : null
    : selectedOperationId;
  const formStats = formOperationId !== null ? getOperationStats(formOperationId) : null;

  // Плитки операций отдают id строкой; выбрана всегда одна — повторный клик выбор не снимает.
  const handleSelectOperation = (id) => {
    if (String(selectedOperationId) === id) return;
    setSelectedOperationId(operationTypes.find((op) => String(op.id) === id)?.id ?? null);
    resetForm();
  };

  const itemLabel = item ? [item.color, item.size, item.material, item.design].filter(Boolean).join(" / ") || `#${item.id}` : "";

  useEffect(() => {
    onItemChange?.(view === "item" ? { label: itemLabel, quantity: itemQuantity } : null);
  }, [view, itemLabel, itemQuantity]);

  useImperativeHandle(ref, () => ({
    back: handleBackToItems,
    refresh: () => (item ? loadItemStickers(item.id, true) : Promise.resolve()),
    openTemplateEditor: () => {
      if (!canEditSticker) return;
      setEditingTemplateId(null);
      setTemplateEditorOpen(true);
    },
  }));

  const remainingScaled = formStats ? Math.round(formStats.remaining * 10000) : 0;

  // Максимум на один стикер при кол-ве стикеров `count` (пусто = 1): остаток / кол-во
  // стикеров, вниз до 4 знаков. Без кол-ва стикеров — весь остаток на один стикер.
  const getMaxPlanned = (count) =>
    formStats ? Math.floor(remainingScaled / (Number(count) > 0 ? Number(count) : 1)) / 10000 : null;

  // Кол-во на стикер и кол-во стикеров по умолчанию — максимум: пока поле не тронуто
  // (null), оно следует за остатком и за другим полем; введённое вручную (даже пустое)
  // остаётся как есть. Не тронуты оба — весь остаток на один стикер.
  const defaultPlanned = getMaxPlanned(form.count);
  const plannedValue = form.planned_quantity ?? (defaultPlanned > 0 ? String(defaultPlanned) : "");

  // Максимум стикеров, которые можно напечатать при кол-ве на стикер: остаток / кол-во
  // на стикер, целое вниз. Считаем в целых (×10^4), чтобы 0.3 / 0.1 не давало 2 из-за
  // float. null — кол-во на стикер ещё не введено.
  const plannedScaled = Math.round((Number(plannedValue) || 0) * 10000);
  const maxCount = formStats && plannedScaled > 0 ? Math.floor(remainingScaled / plannedScaled) : null;
  const countValue = form.count ?? (maxCount > 0 ? String(maxCount) : "");

  const plannedNum = Number(plannedValue) || 0;
  const countNum = Number(countValue) || 0;
  const totalRequested = plannedNum * (countNum || 1);
  // Остаток операции с учётом введённого: кол-во на стикер × кол-во стикеров.
  // Меньше нуля — превышение, добавить нельзя.
  const remainingAfter = formStats ? round4(formStats.remaining - totalRequested) : null;
  const exceedsRemaining = remainingAfter !== null && remainingAfter < 0;

  // Предел числа стикеров для "+" и ввода: пока "на стикер" не введено вручную — по
  // штуке на стикер (само подстроится под число стикеров), иначе сколько влезает в остаток.
  const maxSteps = formStats
    ? form.planned_quantity === null
      ? Math.max(Math.floor(formStats.remaining), 1)
      : Math.max(maxCount ?? 1, 1)
    : 1;

  // На один стикер больше того, что влезает при текущем числе стикеров, не бывает.
  const handlePlannedChange = (raw) => {
    let value = sanitizeNumericInput(raw);
    const cap = getMaxPlanned(form.count);
    if (Number(value) > cap) value = qtyToString(cap);
    setForm((prev) => ({ ...prev, planned_quantity: value }));
  };

  const handleCountChange = (raw) => {
    let value = raw.replace(/\D/g, "");
    if (Number(value) > maxSteps) value = String(maxSteps);
    setForm((prev) => ({ ...prev, count: value }));
  };

  const stepCount = (delta) => {
    const next = Math.min(Math.max((Number(countValue) || 1) + delta, 1), maxSteps);
    setForm((prev) => ({ ...prev, count: String(next) }));
  };

  // "Не делить": обратно к одному стикеру на весь остаток (комментарий остаётся).
  const closeSplit = () => {
    setSplitting(false);
    setForm((prev) => ({ ...prev, planned_quantity: null, count: null }));
  };

  // Что мешает добавить — показываем в подвале панели и алертом по клику на кнопку.
  const blockHint = !formStats
    ? t("workStickerEmptyStep1")
    : exceedsRemaining
      ? t("workStickerExceedsRemaining")
      : !(plannedNum > 0 && countNum > 0)
        ? t("workStickerSplitEnter")
        : "";

  const handleSaveStickers = async (e) => {
    e.preventDefault();
    if (saving || !item) return;

    // Без выбранной операции подсказка тоже говорит, что делать (блок формы — formStats).
    if (blockHint) {
      showAlert(blockHint, "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        planned_quantity: plannedValue,
        count: countValue,
        operation_type_id: formOperationId,
        batch_receipt_item_id: item.id,
      };
      const res = await addWorkStickers(payload);
      if (!res?.success) throw new Error(res?.error || t("error"));

      showAlert(t("success"), "success");
      resetForm();
      // Первая операция создана вверху — раскрываем её группу, дальше форма живёт в ней.
      setOpenGroup(formOperationId);
      loadItemStickers(item.id);
    } catch (err) {
      showAlert(err?.response?.data?.error || err.message || t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePrintAll = (stickers) => {
    if (!stickers || stickers.length === 0) return;
    printWorkStickersPdf(stickers, stickerTemplate);
  };

  const handlePrintOne = (sticker) => {
    printWorkStickersPdf([sticker], stickerTemplate);
  };

  // Общая обвязка для запросов редактора вариантов: флаг сохранения, алерты.
  // Возвращает ответ или null при ошибке.
  const runTemplateAction = async (action) => {
    setSavingTemplate(true);
    try {
      const res = await action();
      if (!res?.success) throw new Error(res?.error || t("error"));
      showAlert(t("success"), "success");
      return res;
    } catch (err) {
      showAlert(err?.response?.data?.error || err.message || t("error"), "error");
      return null;
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSaveTemplate = async (draft) => {
    const res = await runTemplateAction(() => updateWorkStickerTemplate(editingTemplate.id, draft));
    if (res) setTemplates((prev) => prev.map((tpl) => (tpl.id === res.data.id ? res.data : tpl)));
  };

  // Копия или вариант из готового дизайна — новый неактивный вариант; сразу
  // переключаем редактор на него.
  const handleCreateTemplate = async (draft) => {
    const res = await runTemplateAction(() => createWorkStickerTemplate(draft));
    if (!res) return;
    setTemplates((prev) => [...prev, res.data]);
    setEditingTemplateId(res.data.id);
  };

  const handleActivateTemplate = async (id) => {
    const res = await runTemplateAction(() => activateWorkStickerTemplate(id));
    if (res) setTemplates((prev) => prev.map((tpl) => ({ ...tpl, is_active: tpl.id === id })));
  };

  const handleDeleteTemplate = async (id) => {
    const res = await runTemplateAction(() => deleteWorkStickerTemplate(id));
    if (!res) return;
    setTemplates((prev) => prev.filter((tpl) => tpl.id !== id));
    setEditingTemplateId(null);
  };

  const handleDeleteSticker = async () => {
    if (!deleteTarget) return;
    const ids = Array.isArray(deleteTarget) ? deleteTarget : [deleteTarget];
    try {
      const results = await Promise.all(ids.map((id) => deleteWorkStickerById(id)));
      if (!results.every((r) => r.success)) showAlert(t("error"), "error");
      else showAlert(t("success"), "success");
      if (item) loadItemStickers(item.id);
    } catch (err) {
      showAlert(err?.response?.data?.error || t("error"), "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  // Группы по типам операции — только операции, по которым уже напечатаны стикеры.
  // Порядок задаёт сама операция (sort_order); при равном или незаданном (0) —
  // по названию А-Я, как в справочнике. Новая операция появляется после первого добавления.
  const stickerGroups = useMemo(() => {
    const map = new Map();
    itemStickers.forEach((s) => {
      const key = s.operationType?.id ?? "none";
      if (!map.has(key)) map.set(key, { operationType: s.operationType || null, stickers: [] });
      map.get(key).stickers.push(s);
    });
    return Array.from(map.values()).sort((a, b) => {
      if (!a.operationType || !b.operationType) return (a.operationType ? 0 : 1) - (b.operationType ? 0 : 1);
      return (
        (a.operationType.sort_order ?? 0) - (b.operationType.sort_order ?? 0) ||
        (a.operationType.name || "").localeCompare(b.operationType.name || "", "ru")
      );
    });
  }, [itemStickers]);

  // Группы операций свёрнуты по умолчанию, раскрыта может быть только одна —
  // иначе при большом числе операций/стикеров экран превращается в стену карточек.
  useEffect(() => {
    setOpenGroup(null);
    setGroupStatusFilters({});
  }, [item?.id]);

  const toggleGroup = (key) => {
    setOpenGroup((prev) => (prev === key ? null : key));
    resetForm();
  };

  // Данные для превью в редакторе шаблона — реальный уже напечатанный стикер,
  // если есть, иначе собираем из текущей партии/позиции/формы, чтобы партия,
  // цвет/размер/материал и т.п. в конструкторе были настоящими, не выдумкой.
  const templatePreviewSticker =
    itemStickers[0] ||
    (item
      ? {
          sticker_code: "ST-000000",
          planned_quantity: Number(plannedValue) || Number(item.quantity) || 0,
          comment: form.comment || "",
          operationType: operationTypes.find((o) => o.id === formOperationId) || null,
          batchReceiptItem: { ...item, receipt: batch },
        }
      : null);

  // Панель распределения работы — та же, что после приёма работы (WorkStickerRoutePanel):
  // заголовок, карточка с плитками операций, по умолчанию один стикер на весь остаток
  // (дробление за кнопкой), внизу — что будет создано и большая кнопка. Одна и та же вверху
  // страницы (`chooseOperation` — выбор первой операции) и внутри операции с остатком.
  const renderDistributionPanel = ({ chooseOperation }) => {
    const operationName = operationTypes.find((op) => op.id === formOperationId)?.name;
    const tooManyForField = exceedsRemaining || !(plannedNum > 0);

    return (
      <form className={routeStyles.panel} onSubmit={handleSaveStickers}>
        <div className={routeStyles.panelHead}>
          <div className={routeStyles.panelTitle}>{t("workStickerDistributionTitle")}</div>
          <div className={routeStyles.panelSubtitle}>
            {t(chooseOperation ? "workStickerDistributeSubtitle" : "workStickerDistributeRestSubtitle")}
          </div>
        </div>

        <section className={`${routeStyles.section} ${routeStyles.sectionNext}`}>
          <SectionHead
            badge={Icons.print}
            title={chooseOperation ? t("operationType") : operationName || t("operationType")}
            hint={t("workStickerOperationHint")}
            qty={formStats ? formStats.remaining : itemQuantity}
            qtyLabel={t(chooseOperation ? "workStickerTotalQuantity" : "workStickerRemaining")}
          />

          {chooseOperation && (
            <OperationChoice
              options={operationTypes}
              value={selectedOperationId === null ? "" : String(selectedOperationId)}
              onChange={handleSelectOperation}
              label={t("operationType")}
            />
          )}

          {formStats &&
            (splitting ? (
              <div className={routeStyles.splitPanel}>
                <div className={routeStyles.splitFields}>
                  <div className={routeStyles.field}>
                    <label className={routeStyles.fieldLabel} htmlFor="ws-planned-quantity">
                      {t("workStickerSplitPer")}
                    </label>
                    <input
                      id="ws-planned-quantity"
                      type="text"
                      inputMode="decimal"
                      className={`${routeStyles.bigInput} ${tooManyForField ? routeStyles.bigInputError : ""}`}
                      value={plannedValue}
                      onChange={(e) => handlePlannedChange(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onBlur={() => {
                        if (!(plannedNum > 0)) setForm((prev) => ({ ...prev, planned_quantity: null }));
                      }}
                    />
                  </div>

                  <div className={routeStyles.field}>
                    <label className={routeStyles.fieldLabel} htmlFor="ws-count">
                      {t("workStickerSplitCount")}
                    </label>
                    <div className={routeStyles.stepper}>
                      <button
                        type="button"
                        className={routeStyles.stepBtn}
                        aria-label={`${t("workStickerSplitCount")} −`}
                        disabled={(Number(countValue) || 1) <= 1}
                        onClick={() => stepCount(-1)}
                      >
                        −
                      </button>
                      <input
                        id="ws-count"
                        type="text"
                        inputMode="numeric"
                        className={routeStyles.bigInput}
                        value={countValue}
                        onChange={(e) => handleCountChange(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        onBlur={() => {
                          if (!(countNum > 0)) setForm((prev) => ({ ...prev, count: null }));
                        }}
                      />
                      <button
                        type="button"
                        className={routeStyles.stepBtn}
                        aria-label={`${t("workStickerSplitCount")} +`}
                        disabled={(Number(countValue) || 1) >= maxSteps}
                        onClick={() => stepCount(1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Калькуляция слева словами ("99 стикеров по 50 шт." + что останется в позиции),
                    "Не делить" справа — в одной строке, как на приёме работы. */}
                <div className={routeStyles.splitFooter}>
                  <div className={routeStyles.splitResult}>
                    <span>{t("workStickerSplitResult")}:</span>
                    <div className={routeStyles.splitChips}>
                      <span className={`${routeStyles.splitChip} ${routeStyles.splitChipText}`}>
                        <Trans
                          i18nKey={(countNum || 1) === 1 ? "workStickerSplitLineSingle" : "workStickerSplitLine"}
                          count={countNum || 1}
                          values={{ qty: fmtQty(plannedNum) }}
                          components={{ b: <b /> }}
                        />
                      </span>
                    </div>
                  </div>

                  <button type="button" className={`${routeStyles.ghostBtn} ${routeStyles.splitCloseBtn}`} onClick={closeSplit}>
                    {t("workStickerSplitClose")}
                  </button>
                </div>
              </div>
            ) : (
              <div className={routeStyles.oneSticker}>
                <span className={routeStyles.oneStickerText}>{t("workStickerOneSticker")}</span>
                {maxSteps > 1 && (
                  <button type="button" className={routeStyles.ghostBtn} onClick={() => setSplitting(true)}>
                    {t("workStickerSplitOpen")}
                  </button>
                )}
              </div>
            ))}

          {formStats && (
            <div className={routeStyles.field}>
              <label className={routeStyles.fieldLabel} htmlFor="ws-comment">
                {t("comment")}
              </label>
              <input
                id="ws-comment"
                type="text"
                className={routeStyles.textInput}
                value={form.comment}
                onChange={(e) => setForm((prev) => ({ ...prev, comment: e.target.value }))}
              />
            </div>
          )}
        </section>

        <div className={`${routeStyles.footer} ${styles.distributeFooter}`}>
          <span className={`${routeStyles.footerText} ${blockHint ? routeStyles.footerWarn : ""}`}>
            {blockHint || t("workStickerWillCreate", { n: countNum })}
          </span>
          <button
            type="submit"
            className={`${routeStyles.submit} ${blockHint ? routeStyles.submitIncomplete : ""}`}
            disabled={!canAdd || saving}
          >
            <span>{saving ? t("loading") : t("workStickerAddAndPrint")}</span>
            {!saving && <span className={routeStyles.submitArrow}>{Icons.arrowForward}</span>}
          </button>
        </div>
      </form>
    );
  };

  return (
    <div className={`${styles.panel} ${styles.embedded}`}>
      {view === "items" && (
        <>
          {items.length > 0 ? (
            <BatchItemGrid>
              {items.map((it) => (
                <BatchItemCard
                  key={it.id}
                  item={it}
                  addedBy={userDisplayName(it.addedBy) || userDisplayName(batch.addedBy)}
                  onClick={() => handleOpenItem(it)}
                  t={t}
                />
              ))}
            </BatchItemGrid>
          ) : (
            <div className={styles.noData}>{t("noData")}</div>
          )}
        </>
      )}

      {view === "item" && item && (
        <>
          <div className={styles.itemDetailBody}>
            {saving && <Loading />}

            {showTopPanel && <div className={styles.addBlock}>{renderDistributionPanel({ chooseOperation: true })}</div>}

            {!showTopPanel && (
            <div className={styles.printedPanel}>
              <div className={styles.printedTitle}>{t("operations")}</div>

              {loadingStickers ? (
                <Loading />
              ) : stickerGroups.length > 0 ? (
                stickerGroups.map((group) => {
                  const key = group.operationType?.id ?? "none";
                  const isOpen = openGroup === key;
                  const groupFilter = groupStatusFilters[key] || "";
                  const visibleStickers = groupFilter
                    ? group.stickers.filter((s) => s.status === groupFilter)
                    : group.stickers;
                  // Телефон: тот же фильтр селектом (на десктопе — чипы), с количеством по статусам.
                  const statusOptions = [
                    { value: "", label: t("all"), count: group.stickers.length },
                    ...Object.entries(STICKER_STATUS_META).map(([statusKey, meta]) => ({
                      value: statusKey,
                      label: t(meta.labelKey),
                      color: meta.color,
                      count: group.stickers.filter((s) => s.status === statusKey).length,
                    })),
                  ];
                  // Удалить можно невыполненное: в работе и брак (как на сервере).
                  const deletablePendingIds = visibleStickers
                    .filter((s) => s.status === "pending" || s.status === "scrapped")
                    .map((s) => s.id);
                  // stats — сколько ещё можно напечатать из партии (форма печати);
                  // route — движение количества для шапки: пришло / передано дальше / осталось.
                  const stats = getOperationStats(key);
                  const route = routeByOperation.get(key) || {
                    came: 0,
                    passed: 0,
                    defect: 0,
                    rework: 0,
                    incomplete: 0,
                    left: 0,
                  };
                  // Брак / исправление / не выполнено — только если они есть, чтобы шапка не пухла.
                  const lossStats = [
                    { qty: route.defect, labelKey: "workStickerSplitScrap", className: styles.groupStatDanger },
                    { qty: route.rework, labelKey: "workStickerSplitRework", className: styles.groupStatWarn },
                    { qty: route.incomplete, labelKey: "workStickerSplitIncomplete", className: styles.groupStatWarn },
                  ].filter((stat) => stat.qty > 0);
                  const isFinalOperation = Boolean(group.operationType?.is_final);
                  // Операцию добавил тот, кто создал в ней первые стикеры.
                  const firstSticker = group.stickers.reduce((a, s) => (s.id < a.id ? s : a));
                  const operationAddedBy = userDisplayName(firstSticker.addedBy);

                  return (
                    <div key={key} className={styles.stickerGroup}>
                      <div className={styles.stickerGroupHeader} onClick={() => toggleGroup(key)}>
                        <div className={styles.stickerGroupLabel}>
                          <span className={`${styles.stickerGroupChevron} ${isOpen ? styles.stickerGroupChevronOpen : ""}`}>
                            {Icons.chevronDown}
                          </span>
                          {group.operationType?.name || t("operationType")}
                          <span className={styles.sectionCount}>{visibleStickers.length}</span>
                          {operationAddedBy && (
                            <span className={styles.groupAddedBy}>
                              {t("addedBy")}: {operationAddedBy}
                            </span>
                          )}
                        </div>

                        <div
                          className={styles.groupStats}
                          title={`${t("workStickerCame")}: ${fmtNum(route.came)} → ${t("workStickerPassedOn")}: ${fmtNum(route.passed)}`}
                        >
                          {!isFinalOperation && (
                            <span
                              className={`${styles.groupStatFill} ${route.left > 0 ? "" : styles.groupStatFillFull}`}
                              style={{ width: `${route.came > 0 ? Math.min(100, ((route.came - route.left) / route.came) * 100) : 0}%` }}
                            />
                          )}
                          <div className={styles.groupStat}>
                            <span className={styles.groupStatValue}>{fmtNum(route.came)}</span>
                            <span className={styles.groupStatLabel}>{t("workStickerCame")}</span>
                          </div>
                          {lossStats.map((stat) => (
                            <div key={stat.labelKey} className={`${styles.groupStat} ${stat.className}`}>
                              <span className={styles.groupStatValue}>{fmtNum(stat.qty)}</span>
                              <span className={styles.groupStatLabel}>{t(stat.labelKey)}</span>
                            </div>
                          ))}
                          {/* У последней операции следующей нет — передачи и остатка не показываем. */}
                          {!isFinalOperation && (
                            <>
                              <div className={styles.groupStat}>
                                <span className={styles.groupStatValue}>{fmtNum(route.passed)}</span>
                                <span className={styles.groupStatLabel}>{t("workStickerPassedOn")}</span>
                              </div>
                              <div
                                className={`${styles.groupStat} ${route.left > 0 ? styles.groupStatOk : styles.groupStatDanger}`}
                              >
                                <span className={styles.groupStatValue}>{fmtNum(route.left)}</span>
                                <span className={styles.groupStatLabel}>{t("workStickerRemaining")}</span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Фильтры и кнопки не должны раскрывать/сворачивать операцию. */}
                        <div className={styles.stickerGroupActions} onClick={(e) => e.stopPropagation()}>
                          <div className={styles.statusFilterGroup}>
                            <button
                              type="button"
                              className={`${styles.statusFilterChip} ${!groupFilter ? styles.statusFilterChipActive : ""}`}
                              onClick={() => setGroupStatusFilters((prev) => ({ ...prev, [key]: "" }))}
                            >
                              {t("all")}
                            </button>
                            {Object.entries(STICKER_STATUS_META).map(([statusKey, meta]) => (
                              <button
                                key={statusKey}
                                type="button"
                                className={`${styles.statusFilterChip} ${groupFilter === statusKey ? styles.statusFilterChipActive : ""}`}
                                style={groupFilter === statusKey ? { background: `${meta.color}20`, color: meta.color } : undefined}
                                onClick={() => setGroupStatusFilters((prev) => ({ ...prev, [key]: statusKey }))}
                              >
                                <span className={styles.statusDot} style={{ background: meta.color }} />
                                {t(meta.labelKey)}
                              </button>
                            ))}
                          </div>
                          <div className={styles.statusSelectWrap}>
                            <StatusFilterSelect
                              value={groupFilter}
                              onChange={(next) => setGroupStatusFilters((prev) => ({ ...prev, [key]: next }))}
                              options={statusOptions}
                              title={t("status")}
                            />
                          </div>
                          <button
                            type="button"
                            className={`${styles.rowActionBtn} ${styles.rowActionBtnAccent}`}
                            title={t("workStickerPrintAll")}
                            onClick={() => handlePrintAll(visibleStickers)}
                          >
                            {Icons.print}
                          </button>
                          {canDelete && deletablePendingIds.length > 0 && (
                            <button
                              type="button"
                              className={`${styles.rowActionBtn} ${styles.rowActionBtnDanger}`}
                              title={t("workStickerDeleteAll")}
                              onClick={() => setDeleteTarget(deletablePendingIds)}
                            >
                              {Icons.delete}
                            </button>
                          )}
                        </div>
                      </div>

                      {isOpen && canAdd && stats.remaining > 0 && operationTypes.some((op) => op.id === key) && (
                        <div className={styles.addBlock}>{renderDistributionPanel({ chooseOperation: false })}</div>
                      )}

                      {isOpen && (
                        <div className={styles.stickerGrid}>
                          {visibleStickers.map((row) => (
                            <div key={row.id} className={styles.stickerCard}>
                              <span
                                className={styles.stickerStatusDot}
                                style={{ background: getStatusMeta(row.status).color }}
                                title={t(getStatusMeta(row.status).labelKey)}
                              />

                              <div className={styles.stickerCardHeader}>
                                <span className={styles.stickerCardCode}>{row.sticker_code}</span>
                              </div>

                              <div className={styles.stickerCardDate}>
                                {t("workStickerCreatedAt")}: {formatDate(row.added_at)}
                              </div>

                              {userDisplayName(row.addedBy) && (
                                <div className={styles.stickerCardDate}>
                                  {t("workStickerDistributedBy")}: {userDisplayName(row.addedBy)}
                                </div>
                              )}

                              <div className={styles.stickerCardQty}>
                                {t("workStickerFieldQuantity")}: {fmtNum(row.planned_quantity)}
                              </div>

                              <div className={styles.stickerCardFooter}>
                                <div className={styles.rowActions}>
                                  <button
                                    type="button"
                                    className={`${styles.rowActionBtn} ${styles.rowActionBtnAccent}`}
                                    title={t("workStickerPrint")}
                                    onClick={() => handlePrintOne(row)}
                                  >
                                    {Icons.print}
                                  </button>
                                  {canDelete && (row.status === "pending" || row.status === "scrapped") && (
                                    <button
                                      type="button"
                                      className={`${styles.rowActionBtn} ${styles.rowActionBtnDanger}`}
                                      title={t("delete")}
                                      onClick={() => setDeleteTarget(row.id)}
                                    >
                                      {Icons.delete}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                          {visibleStickers.length === 0 && <div className={styles.noData}>{t("noData")}</div>}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                // Распределять нечем или нельзя (нет типов операций / нет прав) — объясняем почему,
                // вместо "Нет данных". Когда можно выбрать операцию, блок скрыт (showTopPanel).
                <div className={styles.emptyHero}>
                  <div className={styles.emptyHeroIcon}>
                    <ListChecks />
                  </div>
                  <h3>{t("workStickerEmptyTitle")}</h3>
                  <p>{canAdd ? t("workStickerEmptyNoTypes") : t("workStickerEmptyReadonly")}</p>
                </div>
              )}
            </div>
            )}
          </div>
        </>
      )}

      <OverlaySidebar
        isOpen={templateEditorOpen}
        onClose={() => setTemplateEditorOpen(false)}
        width="min(620px, 95vw)"
      >
        {editingTemplate && (
          <div className={styles.printModal}>
            {savingTemplate && <Loading />}

            <div className={styles.printModalHeader}>
              <div className={styles.printModalHeaderText}>
                <h2>{t("workStickerTemplateEditor")}</h2>
              </div>
              <span className={styles.printModalClose} onClick={() => setTemplateEditorOpen(false)}>
                {Icons.clear}
              </span>
            </div>

            <div className={styles.printModalBody}>
              {/* key: смена варианта и сохранение пересоздают редактор с чистым черновиком */}
              <StickerTemplateEditor
                key={`${editingTemplate.id}-${editingTemplate.updated_at}`}
                template={editingTemplate}
                templates={templates}
                previewSticker={templatePreviewSticker}
                onSelect={setEditingTemplateId}
                onSave={handleSaveTemplate}
                onCreate={handleCreateTemplate}
                onActivate={handleActivateTemplate}
                onDelete={handleDeleteTemplate}
                saving={savingTemplate}
              />
            </div>
          </div>
        )}
      </OverlaySidebar>

      <CenterModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onAccept={handleDeleteSticker}
        title={t("areYouSureDelete")}
      />
    </div>
  );
});

export default WorkDistributionPanel;
