import { Icons } from "../icons/icons";
import styles from "./BatchItemCard.module.scss";

const NUMBER_FIELDS = new Set(["quantity", "gross_weight_kg"]);

const formatFieldValue = (field, value) => (NUMBER_FIELDS.has(field) ? Number(value).toLocaleString("ru-RU") : value);

const isFilled = (value) => value !== null && value !== undefined && value !== "";

const ITEM_DETAIL_FIELDS = [
  ["color", "color"],
  ["color_variant", "colorVariant"],
  ["color_tone", "colorTone"],
  ["yarn_type", "yarnType"],
  ["material", "material"],
  ["design", "design"],
];

const ITEM_META_FIELDS = [
  ["quantity", "quantity"],
  ["gross_weight_kg", "grossWeight"],
  ["roll_count", "rollCount"],
  ["grammage", "grammage"],
];

// По позиции уже печатались стикеры (работа начата) — в черновике она заблокирована.
export const isStartedItem = (item) => (item._count?.workStickers ?? 0) > 0;

// Поле показывается всегда (пустое — "—"), чтобы у всех карточек данные стояли на одних и тех же местах.
const CardField = ({ label, value }) => {
  const filled = isFilled(value);
  return (
    <div className={styles.cardRow}>
      <span className={styles.cardLabel}>{label}</span>
      <span className={`${styles.cardValue} ${filled ? "" : styles.cardValueEmpty}`} title={filled ? String(value) : undefined}>
        {filled ? value : "—"}
      </span>
    </div>
  );
};

// Сетка карточек: 3 в ряд (на узком экране 2 / 1).
export const BatchItemGrid = ({ children }) => <div className={styles.itemsGrid}>{children}</div>;

// onClick — карточка открывает позицию; onDelete / onCopy — только когда можно
// удалять / копировать (черновик + есть право); showStarted — бейдж "Работа начата"
// (нужен в черновике, где такая позиция заблокирована).
const BatchItemCard = ({ item, addedBy, onClick, onDelete, onCopy, showStarted = false, t }) => (
  <div className={`${styles.itemCard} ${onClick ? styles.itemCardClickable : ""}`} onClick={onClick}>
    <div className={styles.itemCardHeader}>
      <div className={styles.itemCardTitleGroup}>
        <span className={styles.itemCardTitle} title={item.product_name || undefined}>
          {item.product_name || "—"}
        </span>
        {item.size && <span className={styles.itemSizeBadge}>{item.size}</span>}
      </div>
      <div className={styles.itemCardActions}>
        {showStarted && isStartedItem(item) && <span className={styles.itemStartedBadge}>{t("batchItemStarted")}</span>}
        {onCopy && (
          <button type="button" className={styles.itemCopyBtn} title={t("copyBatchItem")} onClick={() => onCopy(item)}>
            {Icons.copy}
          </button>
        )}
        {onDelete && !isStartedItem(item) && (
          <button type="button" className={styles.itemDeleteBtn} title={t("deleteBatchItem")} onClick={() => onDelete(item)}>
            {Icons.delete}
          </button>
        )}
      </div>
    </div>

    <div className={styles.itemCardBody}>
      {ITEM_DETAIL_FIELDS.map(([field, labelKey]) => (
        <CardField key={field} label={t(labelKey)} value={item[field]} />
      ))}
    </div>

    <div className={styles.itemCardFooter}>
      {ITEM_META_FIELDS.map(([field, labelKey]) => (
        <CardField
          key={field}
          label={t(labelKey)}
          value={isFilled(item[field]) ? formatFieldValue(field, item[field]) : null}
        />
      ))}
      <div className={styles.cardRowFull}>
        <CardField label={t("addedBy")} value={addedBy} />
      </div>
    </div>
  </div>
);

export default BatchItemCard;
