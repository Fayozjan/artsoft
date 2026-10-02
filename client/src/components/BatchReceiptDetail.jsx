import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { useProductionAccess } from "../hooks/useProductionAccess";
import {
  getBatchReceiptById,
  acceptBatchReceipt,
  revertBatchReceipt,
  deleteBatchReceiptItem,
  appendBatchReceiptItems,
} from "../api";
import { userDisplayName } from "../utils/userDisplayName";

import Loading from "./Loading";
import CenterModal from "./CenterModal";
import WorkDistributionPanel from "./WorkDistributionPanel";
import BatchItemCard, { BatchItemGrid, isStartedItem } from "./BatchItemCard";
import { Icons } from "../icons/icons";
import styles from "./BatchReceiptDetail.module.scss";

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ru-RU");
};

const fmtNum = (value) => (value === null || value === undefined || value === "" ? "—" : Number(value).toLocaleString("ru-RU"));

const REFRESH_MIN_MS = 400;

const STATUS_META = {
  draft: { color: "#f59e0b", labelKey: "draft" },
  accepted: { color: "#16a34a", labelKey: "accepted" },
};

const MetaChip = ({ label, value, wrap }) => (
  <div className={`${styles.metaChip} ${wrap ? styles.metaChipWrap : ""}`}>
    <span className={styles.metaLabel}>{label}</span>
    <span className={styles.metaValue} title={wrap ? undefined : String(value)}>{value}</span>
  </div>
);

const BatchReceiptDetail = ({ id, canAdd, canEdit, canDelete, onClose, onEdit, onAddItem, onDeleteRequest, onRefresh }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const { canEditSticker } = useProductionAccess();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [data, setData] = useState(null);
  // Открытая позиция в распределении работы: `{ label, quantity }` (null — открыт
  // список позиций). Пока позиция открыта, шапка партии становится шапкой позиции:
  // одна кнопка "Назад" (на уровень выше), название позиции, её количество
  // и шестерёнка шаблона стикера. Напечатано / остаток — внутри каждой операции.
  const [distributionItem, setDistributionItem] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteItemTarget, setDeleteItemTarget] = useState(null);
  const panelRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
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

  // Подтягивает свежие стикеры открытой позиции без перезагрузки страницы.
  // Запрос отвечает за десятки мс — держим состояние загрузки минимум REFRESH_MIN_MS,
  // иначе анимация не успевает появиться и кажется, что ничего не произошло.
  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([panelRef.current?.refresh(), new Promise((resolve) => setTimeout(resolve, REFRESH_MIN_MS))]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAccept = async () => {
    setActionLoading(true);
    try {
      const res = await acceptBatchReceipt(id);
      if (!res?.success) throw new Error();
      showAlert(t("success"), "success");
      setData(res.data);
      onRefresh?.();
    } catch (err) {
      showAlert(err?.response?.data?.error || t("error"), "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevert = async () => {
    setActionLoading(true);
    try {
      const res = await revertBatchReceipt(id);
      if (!res?.success) throw new Error();
      showAlert(t("success"), "success");
      setData(res.data);
      onRefresh?.();
    } catch (err) {
      showAlert(err?.response?.data?.error || t("error"), "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Копия позиции — новая позиция без стикеров (не "начатая"), встаёт в конец списка.
  const handleCopyItem = async (item) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
      const { product_name, color, color_variant, color_tone, size, yarn_type, material, design, quantity, gross_weight_kg, roll_count, grammage } = item;
      const copy = { product_name, color, color_variant, color_tone, size, yarn_type, material, design, quantity, gross_weight_kg, roll_count, grammage };
      const res = await appendBatchReceiptItems(id, [copy]);
      if (!res?.success) throw new Error();
      showAlert(t("success"), "success");
      setData(res.data);
    } catch (err) {
      showAlert(err?.response?.data?.error || t("error"), "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteItemTarget) return;
    const target = deleteItemTarget;
    setDeleteItemTarget(null);
    setActionLoading(true);
    try {
      const res = await deleteBatchReceiptItem(id, target.id);
      if (!res?.success) throw new Error();
      showAlert(t("success"), "success");
      setData(res.data);
    } catch (err) {
      showAlert(err?.response?.data?.error || t("error"), "error");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <Loading />;
  if (!data) return null;

  const meta = STATUS_META[data.status] || STATUS_META.draft;
  const isDraft = data.status === "draft";
  const isAccepted = data.status === "accepted";
  const itemMode = isAccepted && distributionItem !== null;
  const items = data.items || [];
  const hasStartedItems = items.some(isStartedItem);

  return (
    <div className={styles.detail}>
      {actionLoading && <Loading />}

      <div className={styles.header}>
        <button
          type="button"
          className={styles.backBtn}
          onClick={itemMode ? () => panelRef.current?.back() : onClose}
        >
          {Icons.arrowBack}
          <span>{t("back")}</span>
        </button>
        <div className={styles.headerText}>
          <span className={styles.headerEyebrow}>
            {itemMode ? `${t("batchNumber")} ${data.batch_number}` : t("batchNumber")}
          </span>
          <div className={styles.headerTitleRow}>
            <h2>{itemMode ? distributionItem.label : data.batch_number}</h2>
            <span
              className={styles.statusBadge}
              style={{ background: meta.color + "20", color: meta.color }}
            >
              {t(meta.labelKey)}
            </span>
          </div>
        </div>
        {!itemMode && (
          <div className={styles.headerMeta}>
            <MetaChip label={t("documentNumber")} value={data.document_number} />
            <MetaChip label={t("receiptDate")} value={formatDate(data.receipt_date)} />
            <MetaChip label={t("customerOrderNumber")} value={data.order_number || "—"} />
            <MetaChip label={t("customer")} value={data.customer || "—"} />
            <MetaChip label={t("addedBy")} value={userDisplayName(data.addedBy) || "—"} />
            {data.comment && <MetaChip label={t("comment")} value={data.comment} wrap />}
          </div>
        )}
        {itemMode && (
          <div className={styles.headerStat}>
            <span className={styles.headerStatValue}>{fmtNum(distributionItem.quantity)}</span>
            <span className={styles.headerStatLabel}>{t("quantity")}</span>
          </div>
        )}
        {itemMode && (
          <button
            type="button"
            className={`${styles.headerSettings} ${refreshing ? styles.spinning : ""}`}
            title={t("refreshData")}
            disabled={refreshing}
            onClick={handleRefresh}
          >
            {Icons.refresh}
          </button>
        )}
        {itemMode && canEditSticker && (
          <button
            type="button"
            className={styles.headerSettings}
            title={t("workStickerTemplateEditor")}
            onClick={() => panelRef.current?.openTemplateEditor()}
          >
            {Icons.settings}
          </button>
        )}
      </div>

      <div className={`${styles.body} ${refreshing ? styles.bodyRefreshing : ""}`}>
        <div className={styles.section}>
          {!itemMode && (
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>{isAccepted ? t("workStickerBatchItem") : t("lineItems")}</h3>
              <span className={styles.itemsCount}>{items.length}</span>
              {canAdd && isDraft && (
                <button
                  type="button"
                  className={`${styles.actionBtn} ${styles.actionPrimary} ${styles.actionCompact} ${styles.sectionAction}`}
                  onClick={onAddItem}
                >
                  <span>{t("addBatchItem")}</span>
                  <span className={styles.actionIcon}>{Icons.plus}</span>
                </button>
              )}
            </div>
          )}

          {isAccepted ? (
            // Принятая партия — распределение работы прямо в карточке.
            <WorkDistributionPanel
              ref={panelRef}
              key={data.id}
              batch={data}
              canAdd={canAdd}
              canDelete={canDelete}
              onItemChange={setDistributionItem}
            />
          ) : items.length === 0 ? (
            <div className={styles.itemsEmpty}>{t("batchNoItems")}</div>
          ) : (
            <BatchItemGrid>
              {items.map((item) => (
                <BatchItemCard
                  key={item.id}
                  item={item}
                  addedBy={userDisplayName(item.addedBy) || userDisplayName(data.addedBy)}
                  onCopy={canAdd && isDraft ? handleCopyItem : undefined}
                  onDelete={canDelete && isDraft ? setDeleteItemTarget : undefined}
                  showStarted
                  t={t}
                />
              ))}
            </BatchItemGrid>
          )}
        </div>
      </div>

      {/* Действия над партией ("Вернуть в черновик" и т.д.) — только на уровне партии,
          внутри открытой позиции их нет. */}
      {!itemMode && (
        <div className={styles.footer}>
          {canDelete && isDraft && (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionDanger}`}
              onClick={() => onDeleteRequest(data.id)}
              disabled={hasStartedItems}
              title={hasStartedItems ? t("batchDeleteBlocked") : undefined}
            >
              <span>{t("delete")}</span>
              <span className={styles.actionIcon}>{Icons.delete}</span>
            </button>
          )}
          {canEdit && isDraft && (
            <button type="button" className={`${styles.actionBtn} ${styles.actionLight}`} onClick={onEdit}>
              <span>{t("edit")}</span>
              <span className={styles.actionIcon}>{Icons.edit}</span>
            </button>
          )}
          {canEdit && isDraft && (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionPrimary}`}
              onClick={handleAccept}
              disabled={actionLoading || items.length === 0}
            >
              <span>{t("acceptDocument")}</span>
              <span className={`${styles.actionIcon} ${styles.actionIconStroke}`}>{Icons.check}</span>
            </button>
          )}
          {canEdit && !isDraft && (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.actionPrimary} ${styles.actionBack}`}
              onClick={handleRevert}
              disabled={actionLoading}
            >
              <span className={`${styles.actionIcon} ${styles.actionIconStroke}`}>{Icons.arrowBack}</span>
              <span>{t("revertForEditing")}</span>
            </button>
          )}
        </div>
      )}

      <CenterModal
        isOpen={deleteItemTarget !== null}
        onClose={() => setDeleteItemTarget(null)}
        onAccept={handleDeleteItem}
        message={t("batchItemDeleteConfirm", { name: deleteItemTarget?.product_name || "—" })}
      />
    </div>
  );
};

export default BatchReceiptDetail;
