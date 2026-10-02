import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import {
  getBatchReceiptById,
  acceptBatchReceipt,
  revertBatchReceipt,
  deleteBatchReceiptById,
  deleteBatchReceiptItem,
  appendBatchReceiptItems,
} from "../api";
import { userDisplayName } from "../utils/userDisplayName";
import { useBackHandler } from "../context/ScreenStackContext";

import Loading from "./Loading";
import CenterModal from "./CenterModal";
import WorkDistributionPanel from "./WorkDistributionPanel";
import { isStartedItem } from "./BatchItemCard";
import { BatchHeaderSheet, BatchItemSheet } from "./BatchReceiptSheetsTelegram";
import {
  IconCalendar,
  IconHash,
  IconUser,
  IconMessage,
  IconPlus,
  IconEdit,
  IconCopy,
  IconTrash,
  IconCheck,
  IconUndo,
  IconChevronLeft,
  IconRefresh,
  IconLayers,
  IconBox,
} from "./tg/tgIcons";
import ui from "./tg/TgUi.module.scss";
import styles from "./BatchReceiptDetailTelegram.module.scss";

const formatDate = (dateStr) => (dateStr ? new Date(dateStr).toLocaleDateString("ru-RU") : "—");

const fmtNum = (value) =>
  value === null || value === undefined || value === ""
    ? "—"
    : Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 4 });

const isFilled = (value) => value !== null && value !== undefined && value !== "";

const REFRESH_MIN_MS = 400;

// В Telegram есть системная кнопка «назад» — своя в шапке не нужна (вне Telegram остаётся).
const hasNativeBackButton = () => Boolean(window.Telegram?.WebApp?.initData);

// Характеристики позиции — показываем только заполненные, в две колонки.
const DETAIL_FIELDS = [
  ["color", "color"],
  ["color_variant", "colorVariant"],
  ["color_tone", "colorTone"],
  ["yarn_type", "yarnType"],
  ["material", "material"],
  ["design", "design"],
];

const METRIC_FIELDS = [
  ["gross_weight_kg", "grossWeight"],
  ["roll_count", "rollCount"],
  ["grammage", "grammage"],
];

const MetaCell = ({ icon, label, value, wide }) => (
  <div className={`${styles.metaCell} ${wide ? styles.metaCellWide : ""}`}>
    <span className={styles.metaIcon}>{icon}</span>
    <div className={styles.metaText}>
      <span className={styles.metaLabel}>{label}</span>
      <span className={styles.metaValue}>{value}</span>
    </div>
  </div>
);

const ItemCard = ({ item, index, addedBy, canAdd, canEdit, canDelete, isDraft, onEdit, onCopy, onDelete, t }) => {
  const started = isStartedItem(item);
  const details = DETAIL_FIELDS.filter(([field]) => isFilled(item[field]));
  const metrics = METRIC_FIELDS.filter(([field]) => isFilled(item[field]));

  return (
    <article className={`${styles.item} ${started ? styles.itemStarted : ""}`}>
      <div className={styles.itemHead}>
        <span className={styles.itemIndex}>{index + 1}</span>
        <div className={styles.itemTitleBlock}>
          <h3 className={styles.itemTitle}>{item.product_name || "—"}</h3>
          {addedBy && <span className={styles.itemAuthor}>{addedBy}</span>}
        </div>
        {item.size && <span className={styles.sizeChip}>{item.size}</span>}
      </div>

      <div className={styles.qtyRow}>
        <div className={styles.qtyMain}>
          <span className={styles.qtyLabel}>{t("quantity")}</span>
          <span className={styles.qtyValue}>{fmtNum(item.quantity)}</span>
        </div>
        {metrics.map(([field, labelKey]) => (
          <div className={styles.qtyMini} key={field}>
            <span className={styles.qtyLabel}>{t(labelKey)}</span>
            <span className={styles.qtyMiniValue}>{fmtNum(item[field])}</span>
          </div>
        ))}
      </div>

      {details.length > 0 && (
        <dl className={styles.details}>
          {details.map(([field, labelKey]) => (
            <div key={field}>
              <dt>{t(labelKey)}</dt>
              <dd>{item[field]}</dd>
            </div>
          ))}
        </dl>
      )}

      {(started || (isDraft && (canAdd || canEdit || canDelete))) && (
        <div className={styles.itemFoot}>
          {started ? <span className={styles.startedBadge}>{t("batchItemStarted")}</span> : <span />}
          {isDraft && (
            <div className={styles.itemActions}>
              {canEdit && !started && (
                <button type="button" className={styles.iconBtn} onClick={() => onEdit(item)} aria-label={t("edit")}>
                  <IconEdit />
                </button>
              )}
              {canAdd && (
                <button type="button" className={styles.iconBtn} onClick={() => onCopy(item)} aria-label={t("copyBatchItem")}>
                  <IconCopy />
                </button>
              )}
              {canDelete && !started && (
                <button
                  type="button"
                  className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                  onClick={() => onDelete(item)}
                  aria-label={t("deleteBatchItem")}
                >
                  <IconTrash />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
};

// Карточка партии в Telegram: шапка с данными, позиции карточками и закреплённая
// панель действий. Принятая партия вместо списка показывает распределение работы.
const BatchReceiptDetailTelegram = ({ id, canAdd, canEdit, canDelete, onClose, onChanged }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [data, setData] = useState(null);
  // Открытая позиция распределения: { label, quantity } (null — открыт список позиций).
  const [distributionItem, setDistributionItem] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const [sheet, setSheet] = useState(null); // "header" | "item" | null
  const [editingItem, setEditingItem] = useState(null);
  const [deleteItemTarget, setDeleteItemTarget] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const panelRef = useRef(null);

  // silent — перезагрузка без полноэкранного лоадера (после правки шапки).
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getBatchReceiptById(id);
      setData(res.data);
    } catch (err) {
      console.error(err);
      showAlert(t("error"), "error");
      onClose?.();
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([panelRef.current?.refresh(), new Promise((resolve) => setTimeout(resolve, REFRESH_MIN_MS))]);
    } finally {
      setRefreshing(false);
    }
  };

  // Общая обвязка действий над партией: лоадер, алерты, подстановка ответа сервера.
  const run = async (action, { applyResult = true, notify = true } = {}) => {
    setActionLoading(true);
    try {
      const res = await action();
      if (!res?.success) throw new Error();
      if (notify) showAlert(t("success"), "success");
      if (applyResult && res.data) setData(res.data);
      onChanged?.();
      return res;
    } catch (err) {
      showAlert(err?.response?.data?.error || t("error"), "error");
      return null;
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = () => run(() => acceptBatchReceipt(id));
  const handleRevert = () => run(() => revertBatchReceipt(id));

  // Копия позиции — новая позиция без стикеров, встаёт в конец списка.
  const handleCopyItem = (item) => {
    if (actionLoading) return;
    const { product_name, color, color_variant, color_tone, size, yarn_type, material, design, quantity, gross_weight_kg, roll_count, grammage } = item;
    run(() =>
      appendBatchReceiptItems(id, [
        { product_name, color, color_variant, color_tone, size, yarn_type, material, design, quantity, gross_weight_kg, roll_count, grammage },
      ]),
    );
  };

  const handleDeleteItem = async () => {
    const target = deleteItemTarget;
    setDeleteItemTarget(null);
    if (target) await run(() => deleteBatchReceiptItem(id, target.id));
  };

  const handleDeleteBatch = async () => {
    setConfirmDelete(false);
    setActionLoading(true);
    try {
      const { success } = await deleteBatchReceiptById(id);
      if (!success) throw new Error();
      showAlert(t("success"), "success");
      onChanged?.();
      onClose?.();
    } catch (err) {
      showAlert(err?.response?.data?.error || t("error"), "error");
      setActionLoading(false);
    }
  };

  // editingItem не сбрасываем: пока шторка уезжает вниз, её заголовок не должен «перескочить».
  const closeSheet = () => setSheet(null);

  // Открыта позиция распределения: системное «назад» Telegram возвращает к списку позиций,
  // а не закрывает всю партию.
  const inItem = data?.status === "accepted" && distributionItem !== null;
  useBackHandler(() => panelRef.current?.back(), inItem);

  if (loading) return <Loading />;
  if (!data) return null;

  const isDraft = data.status === "draft";
  const isAccepted = data.status === "accepted";
  const itemMode = isAccepted && distributionItem !== null;
  const items = data.items || [];
  const hasStartedItems = items.some(isStartedItem);
  const showActionBar = !itemMode && ((isDraft && (canDelete || canEdit)) || (isAccepted && canEdit));

  return (
    <div className={styles.screen} data-status={data.status}>
      {actionLoading && <Loading />}
      <div className={styles.topGlass} />

      <div className={`${styles.scroll} ${showActionBar ? styles.scrollWithBar : ""} ${refreshing ? styles.refreshing : ""}`}>
        {itemMode ? (
          <header className={styles.itemBar}>
            <div className={styles.itemBarTop}>
              {!hasNativeBackButton() && (
                <button type="button" className={styles.backChip} onClick={() => panelRef.current?.back()}>
                  <IconChevronLeft />
                  <span>{t("back")}</span>
                </button>
              )}
              <span className={styles.itemBarEyebrow}>
                <IconBox />
                <span>
                  {t("batchNumber")} {data.batch_number}
                </span>
              </span>
              <button
                type="button"
                className={`${styles.iconBtn} ${refreshing ? styles.spin : ""}`}
                onClick={handleRefresh}
                disabled={refreshing}
                aria-label={t("refreshData")}
              >
                <IconRefresh />
              </button>
            </div>

            <div className={styles.itemBarMain}>
              <h2 className={styles.itemBarTitle}>{distributionItem.label}</h2>
              <div className={styles.itemBarQty}>
                <span>{t("quantity")}</span>
                <b>{fmtNum(distributionItem.quantity)}</b>
              </div>
            </div>
          </header>
        ) : (
          <section className={styles.hero}>
            <div className={styles.heroHead}>
              <div className={styles.heroHeadText}>
                <span className={styles.heroEyebrow}>{t("batchNumber")}</span>
                <h1 className={styles.heroTitle}>{data.batch_number}</h1>
              </div>
              <span className={`${styles.statusPill} ${isAccepted ? styles.statusAccepted : styles.statusDraft}`}>
                {t(data.status)}
              </span>
            </div>

            <div className={styles.metaGrid}>
              <MetaCell icon={<IconCalendar />} label={t("receiptDate")} value={formatDate(data.receipt_date)} />
              <MetaCell icon={<IconHash />} label={t("customerOrderNumber")} value={data.order_number || "—"} />
              <MetaCell icon={<IconUser />} label={t("customer")} value={data.customer || "—"} wide />
              <MetaCell icon={<IconUser />} label={t("addedBy")} value={userDisplayName(data.addedBy) || "—"} wide />
            </div>

            {data.comment && (
              <div className={styles.comment}>
                <IconMessage />
                <span>{data.comment}</span>
              </div>
            )}
          </section>
        )}

        {!itemMode && (
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>
              <IconLayers />
              {isAccepted ? t("workStickerBatchItem") : t("lineItems")}
            </h2>
            <span className={styles.count}>{items.length}</span>
            {canAdd && isDraft && (
              <button
                type="button"
                className={styles.addPill}
                onClick={() => {
                  setEditingItem(null);
                  setSheet("item");
                }}
              >
                <IconPlus />
                <span>{t("add")}</span>
              </button>
            )}
          </div>
        )}

        {isAccepted ? (
          <div className={styles.distribution}>
            <WorkDistributionPanel
              ref={panelRef}
              key={data.id}
              batch={data}
              canAdd={canAdd}
              canDelete={canDelete}
              onItemChange={setDistributionItem}
            />
          </div>
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyIcon}>
              <IconLayers />
            </span>
            <p>{t("batchNoItems")}</p>
          </div>
        ) : (
          <div className={styles.items}>
            {hasStartedItems && <p className={styles.lockedHint}>{t("batchItemsLockedHint")}</p>}
            {items.map((item, index) => (
              <ItemCard
                key={item.id}
                item={item}
                index={index}
                addedBy={userDisplayName(item.addedBy) || userDisplayName(data.addedBy)}
                canAdd={canAdd}
                canEdit={canEdit}
                canDelete={canDelete}
                isDraft={isDraft}
                onEdit={(it) => {
                  setEditingItem(it);
                  setSheet("item");
                }}
                onCopy={handleCopyItem}
                onDelete={setDeleteItemTarget}
                t={t}
              />
            ))}
          </div>
        )}
      </div>

      {showActionBar && (
        <div className={styles.actionBar}>
          {isDraft ? (
            <>
              {canDelete && (
                <button
                  type="button"
                  className={`${ui.btn} ${ui.btnDanger} ${ui.btnIcon}`}
                  onClick={() => setConfirmDelete(true)}
                  disabled={hasStartedItems}
                  aria-label={t("delete")}
                  title={hasStartedItems ? t("batchDeleteBlocked") : undefined}
                >
                  <IconTrash />
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  className={`${ui.btn} ${ui.btnSecondary} ${ui.btnIcon}`}
                  onClick={() => setSheet("header")}
                  aria-label={t("edit")}
                >
                  <IconEdit />
                </button>
              )}
              {canEdit && (
                <button
                  type="button"
                  className={`${ui.btn} ${ui.btnPrimary}`}
                  onClick={handleAccept}
                  disabled={actionLoading || items.length === 0}
                >
                  <IconCheck />
                  <span>{t("acceptDocument")}</span>
                </button>
              )}
            </>
          ) : (
            <button type="button" className={`${ui.btn} ${ui.btnSecondary}`} onClick={handleRevert} disabled={actionLoading}>
              <IconUndo />
              <span>{t("revertForEditing")}</span>
            </button>
          )}
        </div>
      )}

      <BatchHeaderSheet
        isOpen={sheet === "header"}
        batch={data}
        onClose={closeSheet}
        onSaved={() => {
          closeSheet();
          load(true);
          onChanged?.();
        }}
      />

      <BatchItemSheet
        isOpen={sheet === "item"}
        batch={data}
        item={editingItem}
        onClose={closeSheet}
        onSaved={(nextData) => {
          closeSheet();
          if (nextData) setData(nextData);
          else load(true);
          onChanged?.();
        }}
      />

      <CenterModal
        isOpen={deleteItemTarget !== null}
        onClose={() => setDeleteItemTarget(null)}
        onAccept={handleDeleteItem}
        message={t("batchItemDeleteConfirm", { name: deleteItemTarget?.product_name || "—" })}
      />

      <CenterModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onAccept={handleDeleteBatch}
        message={t("areYouSureDelete")}
      />
    </div>
  );
};

export default BatchReceiptDetailTelegram;
