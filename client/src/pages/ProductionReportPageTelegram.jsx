import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";

import {
  getOperationTypes,
  getProductionReportByEmployee,
  getProductionReportByOperation,
  getProductionReportByOrder,
  getProductionReportBySticker,
  getProductionReportMonitoring,
  getProductionReportStickerItemAttributes,
} from "../api";
import { useAlertStore } from "../stores/alertStore";
import { usePermissionsTelegram } from "../hooks/usePermissionsTelegram";
import { useProductionAccess } from "../hooks/useProductionAccess";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { STICKER_STATUS_KEYS } from "../utils/stickerStatus";

import EmployeeCell from "../components/EmployeeCell";
import StickerStatusBadge from "../components/StickerStatusBadge";
import StickerChronology from "../components/StickerChronology";
import StickerRateModal from "../components/StickerRateModal";
import TgSheet from "../components/tg/TgSheet";
import {
  IconSearch,
  IconClose,
  IconFilter,
  IconChevronRight,
  IconChevronDown,
  IconLayers,
  IconUsers,
  IconSliders,
  IconBox,
  IconTrend,
  IconQr,
  IconCopy,
  IconEdit,
  IconClock,
} from "../components/tg/tgIcons";
import ui from "../components/tg/TgUi.module.scss";
import styles from "./ProductionReportPageTelegram.module.scss";

const STICKER_PAGE_SIZE = 20;

// Порядок ключей = порядок вкладок; первая вкладка открывается по умолчанию.
const TAB_LOADERS = {
  order: getProductionReportByOrder,
  employee: getProductionReportByEmployee,
  operation: getProductionReportByOperation,
  sticker: getProductionReportBySticker,
  monitoring: getProductionReportMonitoring,
};

const TAB_TITLES = {
  order: "productionReportByOrder",
  employee: "productionReportByEmployee",
  operation: "productionReportByOperation",
  sticker: "productionReportBySticker",
  monitoring: "productionReportMonitoring",
};

const TAB_HINTS = {
  order: "prodPeriodBatchHint",
  employee: "prodPeriodEmployeeHint",
  operation: "prodPeriodEmployeeHint",
  sticker: "prodPeriodStickerHint",
  monitoring: "prodPeriodMonitoringHint",
};

const TAB_ICONS = {
  order: IconBox,
  employee: IconUsers,
  operation: IconSliders,
  sticker: IconQr,
  monitoring: IconTrend,
};

const TABS_ORDER = Object.keys(TAB_TITLES);

const MONITORING_METRICS = [
  { field: "arrived_qty", label: "prodMonitoringArrived", tone: styles.toneArrived },
  { field: "pending_qty", label: "prodMonitoringInProgress", tone: styles.tonePending },
  { field: "done_qty", label: "prodMonitoringDone", tone: styles.toneDone },
];

const fmtQty = (value) => Number(value || 0).toLocaleString("ru-RU", { maximumFractionDigits: 4 });

const fmtMoney = (value) =>
  Number(value || 0).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (value) => (value ? dayjs(value).format("DD.MM.YYYY") : "—");

const fmtDateTime = (value) => (value ? dayjs(value).format("DD.MM.YYYY HH:mm") : "—");

const itemTitle = (item) => [item.product_name, item.size].filter(Boolean).join(" · ") || "—";

const itemAttributes = (item) =>
  [item.color, item.color_variant, item.color_tone, item.yarn_type, item.material, item.design]
    .filter(Boolean)
    .join(" · ");

const acceptedPeriodFilters = () => ({
  date_from: dayjs().startOf("month").format("YYYY-MM-DD"),
  date_to: dayjs().format("YYYY-MM-DD"),
  search: "",
  operation_type_id: "",
});

const todayPeriodFilters = () => ({
  date_from: dayjs().format("YYYY-MM-DD"),
  date_to: dayjs().format("YYYY-MM-DD"),
  search: "",
  operation_type_id: "",
});

const defaultFilters = () => ({
  order: { date_from: "", date_to: "", search: "", operation_type_id: "" },
  employee: acceptedPeriodFilters(),
  operation: acceptedPeriodFilters(),
  monitoring: todayPeriodFilters(),
  sticker: {
    date_from: "",
    date_to: "",
    search: "",
    operation_type_id: "",
    status: "",
    size: "",
    design: "",
    material: "",
    grammage: "",
  },
});

const emptyReportState = () => ({
  order: { data: [], totals: null, loading: true, loaded: false },
  employee: { data: [], totals: null, loading: true, loaded: false },
  operation: { data: [], totals: null, loading: true, loaded: false },
  monitoring: { data: [], totals: null, loading: true, loaded: false },
  sticker: {
    data: [],
    totals: null,
    pagination: null,
    loading: true,
    loadingMore: false,
    loaded: false,
    page: 1,
    hasMore: true,
  },
});

// Копирование кода: Clipboard API есть только в secure context — иначе через временный textarea.
const copyText = async (text) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
};

// ── Мелкие переиспользуемые куски ───────────────────────────────────────────

const Tile = ({ label, value, tone }) => (
  <div className={`${styles.tile} ${tone || ""}`}>
    <span>{label}</span>
    <b>{value}</b>
  </div>
);

const ProgressBar = ({ value }) => (
  <div className={styles.progressWrap}>
    <div className={styles.progressTrack}>
      <div className={styles.progressFill} style={{ width: `${Math.min(value || 0, 100)}%` }} />
    </div>
    <span className={styles.progressLabel}>{value || 0}%</span>
  </div>
);

const KpiStrip = ({ items }) => (
  <div className={styles.kpiStrip}>
    {items.map((item) => (
      <div key={item.label} className={styles.kpiChip}>
        <span>{item.label}</span>
        <b className={item.tone}>{item.value}</b>
      </div>
    ))}
  </div>
);

const SkeletonCard = () => (
  <div className={styles.skeleton}>
    <span className={styles.skLine} style={{ width: "45%" }} />
    <span className={styles.skLine} style={{ width: "70%", height: 18 }} />
    <span className={styles.skLine} style={{ width: "90%", height: 40 }} />
  </div>
);

const EmptyState = ({ icon, text }) => (
  <div className={styles.empty}>
    <span className={styles.emptyIcon}>{icon}</span>
    <p>{text}</p>
  </div>
);

const MoreLoader = () => (
  <div className={styles.moreLoader}>
    <span />
    <span />
    <span />
  </div>
);

const SelectField = ({ value, onChange, options, allLabel }) => (
  <span className={styles.selectWrap}>
    <select className={ui.input} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
    <span className={styles.selectChevron}>
      <IconChevronDown />
    </span>
  </span>
);

// Список карточек одной вкладки: скелетон → пусто → карточки.
const ReportList = ({ state, renderItem, emptyIcon, emptyText }) => {
  if (state.loading && state.data.length === 0) {
    return (
      <div className={styles.list}>
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }
  if (state.loaded && state.data.length === 0) {
    return <EmptyState icon={emptyIcon} text={emptyText} />;
  }
  return <div className={styles.list}>{state.data.map(renderItem)}</div>;
};

// ── Карточки вкладок ─────────────────────────────────────────────────────────

const OrderCard = ({ row, t, onOpen }) => (
  <div className={styles.card} role="button" tabIndex={0} onClick={() => onOpen(row)} onKeyDown={(e) => e.key === "Enter" && onOpen(row)}>
    <div className={styles.cardTitleRow}>
      <div className={styles.cardTitleMain}>
        <h3 className={styles.cardTitle}>{row.order_number || t("prodNoOrder")}</h3>
        {row.customers.length > 0 && <p className={styles.cardSubtitle}>{row.customers.join(" · ")}</p>}
      </div>
      <span className={styles.cardChevron}>
        <IconChevronRight />
      </span>
    </div>

    <ProgressBar value={row.progress} />

    <div className={styles.tiles}>
      <Tile label={t("prodBatchesCount")} value={row.batches_count} />
      <Tile label={t("prodBatchQty")} value={fmtQty(row.received_qty)} />
      <Tile label={t("workStickerPending")} value={fmtQty(row.pending_qty)} tone={styles.tileWarn} />
      <Tile label={t("prodDoneQty")} value={fmtQty(row.finished_qty)} tone={styles.tileGood} />
      {row.rework_qty > 0 && <Tile label={t("prodReworkQty")} value={fmtQty(row.rework_qty)} tone={styles.tileWarn} />}
      {row.scrap_qty > 0 && <Tile label={t("prodScrapQty")} value={fmtQty(row.scrap_qty)} tone={styles.tileBad} />}
    </div>

    <div className={styles.cardFooter}>
      <span className={styles.footerStat}>
        <IconUsers />
        {row.employees_count}
      </span>
      <b className={styles.amount}>{fmtMoney(row.amount)}</b>
    </div>
  </div>
);

const EmployeeCard = ({ row, t, onOpen }) => (
  <div className={styles.card} role="button" tabIndex={0} onClick={() => onOpen(row)} onKeyDown={(e) => e.key === "Enter" && onOpen(row)}>
    <div className={styles.cardTitleRow}>
      <EmployeeCell
        photo={row.employeePhoto}
        fullName={row.label}
        id={row.employee_id}
        branch={row.branchName}
        department={row.departmentName}
        active={row.employee_status !== false}
        previewable={false}
      />
      <span className={styles.cardChevron}>
        <IconChevronRight />
      </span>
    </div>

    <div className={styles.tiles}>
      <Tile label={t("prodStickers")} value={row.stickers} />
      <Tile label={t("prodDoneQty")} value={fmtQty(row.qty)} tone={styles.tileGood} />
      {row.defect_qty > 0 && <Tile label={t("prodScrapQty")} value={fmtQty(row.defect_qty)} tone={styles.tileBad} />}
      {row.rework_qty > 0 && <Tile label={t("prodReworkQty")} value={fmtQty(row.rework_qty)} tone={styles.tileWarn} />}
      <Tile label={t("prodAvgRate")} value={fmtMoney(row.avg_rate)} />
      {row.deduction > 0 && <Tile label={t("prodDeduction")} value={fmtMoney(row.deduction)} tone={styles.tileBad} />}
    </div>

    <div className={styles.cardFooter}>
      <span className={styles.footerStat}>
        <IconLayers />
        {row.batches_count} · {row.operations_count}
      </span>
      <b className={styles.amount}>{fmtMoney(row.amount)}</b>
    </div>
  </div>
);

const OperationCard = ({ row, t, onOpen }) => (
  <div className={styles.card} role="button" tabIndex={0} onClick={() => onOpen(row)} onKeyDown={(e) => e.key === "Enter" && onOpen(row)}>
    <div className={styles.cardTitleRow}>
      <div className={styles.cardTitleMain}>
        <h3 className={styles.cardTitle}>{row.name}</h3>
      </div>
      <span className={styles.cardChevron}>
        <IconChevronRight />
      </span>
    </div>

    <div className={styles.tiles}>
      <Tile label={t("prodStickers")} value={row.stickers} />
      <Tile label={t("prodDoneQty")} value={fmtQty(row.qty)} tone={styles.tileGood} />
      <Tile label={t("prodAvgRate")} value={fmtMoney(row.avg_rate)} />
      {row.deduction > 0 && <Tile label={t("prodDeduction")} value={fmtMoney(row.deduction)} tone={styles.tileBad} />}
    </div>

    <div className={styles.cardFooter}>
      <span className={styles.footerStat}>
        <IconLayers />
        {row.batches_count} · <IconUsers /> {row.employees_count}
      </span>
      <b className={styles.amount}>{fmtMoney(row.amount)}</b>
    </div>
  </div>
);

// Мониторинг: карточка операции (или «Итого») с тремя показателями и, при наличии,
// раскрывающимся списком партий по клику.
const MonitoringCard = ({ card, t, onOpen }) => (
  <div
    className={`${styles.card} ${styles.monitoringCard} ${card.total ? styles.monitoringTotal : ""}`}
    role={card.batches?.length > 0 ? "button" : undefined}
    tabIndex={card.batches?.length > 0 ? 0 : undefined}
    onClick={card.batches?.length > 0 ? () => onOpen(card) : undefined}
    onKeyDown={card.batches?.length > 0 ? (e) => e.key === "Enter" && onOpen(card) : undefined}
  >
    <div className={styles.cardTitleRow}>
      <h3 className={styles.cardTitle}>{card.name}</h3>
      {card.batches?.length > 0 && (
        <span className={styles.cardChevron}>
          <IconChevronRight />
        </span>
      )}
    </div>
    <div className={styles.tiles}>
      {MONITORING_METRICS.map(({ field, label, tone }) => (
        <Tile key={field} label={t(label)} value={fmtQty(card.values[field])} tone={card.values[field] ? tone : ""} />
      ))}
    </div>
  </div>
);

// ── Тело шторки — детали заказа: партия → позиция → операция → сотрудники ────

const TreeRow = ({ open, title, subtitle, right, onToggle }) => (
  <button type="button" className={styles.treeRow} onClick={onToggle}>
    <span className={styles.treeChevron}>{open ? <IconChevronDown /> : <IconChevronRight />}</span>
    <span className={styles.treeMain}>
      <span className={styles.treeTitle}>{title}</span>
      {subtitle && <span className={styles.treeSub}>{subtitle}</span>}
    </span>
    {right && <span className={styles.treeRight}>{right}</span>}
  </button>
);

const OperationNode = ({ op, expanded, toggle, parentKey, t }) => {
  const key = `${parentKey}/op-${op.operation_type_id}`;
  const open = expanded.has(key);
  return (
    <div className={styles.treeGroup}>
      <TreeRow
        open={open}
        title={op.name}
        subtitle={`${fmtDate(op.arrived_at)} → ${fmtDate(op.finished_at)}`}
        right={
          <>
            <b>{fmtQty(op.done_qty)}</b>/{fmtQty(op.pending_qty + op.done_qty)}
          </>
        }
        onToggle={() => toggle(key)}
      />
      {open && (
        <div className={styles.treeChildren}>
          {op.employees.length > 0 ? (
            op.employees.map((employee) => (
              <div key={employee.employee_id} className={styles.opEmployeeRow}>
                <span className={styles.opEmployeeName}>{employee.label}</span>
                <div className={styles.opEmployeeStats}>
                  <span>{fmtQty(employee.qty)}</span>
                  <b>{fmtMoney(employee.amount)}</b>
                </div>
              </div>
            ))
          ) : (
            <p className={styles.treeEmpty}>{t("noData")}</p>
          )}
        </div>
      )}
    </div>
  );
};

const ItemNode = ({ item, expanded, toggle, parentKey, t }) => {
  const key = `${parentKey}/${item.key}`;
  const open = expanded.has(key);
  return (
    <div className={styles.treeGroup}>
      <TreeRow
        open={open}
        title={itemTitle(item)}
        subtitle={itemAttributes(item)}
        right={
          <>
            <b>{fmtQty(item.finished_qty)}</b>/{fmtQty(item.received_qty)}
          </>
        }
        onToggle={() => toggle(key)}
      />
      {open && (
        <div className={styles.treeChildren}>
          {item.operations.length > 0 ? (
            item.operations.map((op) => <OperationNode key={op.operation_type_id} op={op} expanded={expanded} toggle={toggle} parentKey={key} t={t} />)
          ) : (
            <p className={styles.treeEmpty}>{t("noData")}</p>
          )}
        </div>
      )}
    </div>
  );
};

const BatchNode = ({ batch, expanded, toggle, parentKey, t }) => {
  const key = `${parentKey}/${batch.key}`;
  const open = expanded.has(key);
  return (
    <div className={styles.treeGroup}>
      <TreeRow
        open={open}
        title={batch.batch_number}
        subtitle={[batch.document_number, batch.customer].filter(Boolean).join(" · ")}
        right={
          <>
            <b>{fmtQty(batch.finished_qty)}</b>/{fmtQty(batch.received_qty)}
          </>
        }
        onToggle={() => toggle(key)}
      />
      {open && (
        <div className={styles.treeChildren}>
          <div className={styles.treeMeta}>
            {fmtDate(batch.receipt_date)} · {t("prodProgress")} {batch.progress}% · {fmtMoney(batch.amount)}
          </div>
          {batch.items.length > 0 ? (
            batch.items.map((item) => <ItemNode key={item.key} item={item} expanded={expanded} toggle={toggle} parentKey={key} t={t} />)
          ) : (
            <p className={styles.treeEmpty}>{t("noData")}</p>
          )}
        </div>
      )}
    </div>
  );
};

const OrderDetailBody = ({ row, t }) => {
  const [expanded, setExpanded] = useState(() => new Set());
  const toggle = (key) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className={styles.tree}>
      {row.batches.map((batch) => (
        <BatchNode key={batch.key} batch={batch} expanded={expanded} toggle={toggle} parentKey={row.key} t={t} />
      ))}
    </div>
  );
};

const EmployeeDetailBody = ({ row }) => (
  <div className={styles.flatList}>
    {row.details.map((detail) => (
      <div key={`${detail.batch_id}-${detail.operation_type_id}`} className={styles.flatRow}>
        <div className={styles.flatMain}>
          <b>{detail.batch_number}</b>
          <span>{detail.name}</span>
          {detail.customer && <span className={styles.muted}>{detail.customer}</span>}
        </div>
        <div className={styles.flatStats}>
          <span>{detail.stickers} шт</span>
          <span>{fmtQty(detail.qty)}</span>
          {detail.deduction > 0 && <span className={styles.negative}>-{fmtMoney(detail.deduction)}</span>}
          <b>{fmtMoney(detail.amount)}</b>
        </div>
      </div>
    ))}
  </div>
);

const OperationDetailBody = ({ row, t }) => (
  <>
    <p className={styles.sectionTitle}>{t("productionReportByEmployee")}</p>
    <div className={styles.flatList}>
      {row.employees.map((employee) => (
        <div key={employee.employee_id} className={styles.flatRow}>
          <EmployeeCell
            compact
            photo={employee.employeePhoto}
            fullName={employee.label}
            id={employee.employee_id}
            branch={employee.branchName}
            department={employee.departmentName}
            active={employee.employee_status !== false}
            previewable={false}
          />
          <div className={styles.flatStats}>
            <span>{employee.stickers} шт</span>
            <span>{fmtQty(employee.qty)}</span>
            {employee.deduction > 0 && <span className={styles.negative}>-{fmtMoney(employee.deduction)}</span>}
            <b>{fmtMoney(employee.amount)}</b>
          </div>
        </div>
      ))}
    </div>

    <p className={styles.sectionTitle}>{t("productionReportByBatch")}</p>
    <div className={styles.flatList}>
      {row.batches.map((batch) => (
        <div key={batch.batch_id} className={styles.flatRow}>
          <div className={styles.flatMain}>
            <b>{batch.batch_number}</b>
            <span className={styles.muted}>{fmtDate(batch.receipt_date)}</span>
            {batch.customer && <span className={styles.muted}>{batch.customer}</span>}
          </div>
          <div className={styles.flatStats}>
            <span>{batch.stickers} шт</span>
            <span>{fmtQty(batch.qty)}</span>
            {batch.deduction > 0 && <span className={styles.negative}>-{fmtMoney(batch.deduction)}</span>}
            <b>{fmtMoney(batch.amount)}</b>
          </div>
        </div>
      ))}
    </div>
  </>
);

const MonitoringDetailBody = ({ card, t }) => (
  <div className={styles.flatList}>
    {(card.batches || []).map((batch) => (
      <div key={batch.batch_id} className={styles.flatRow}>
        <div className={styles.flatMain}>
          <b>{batch.batch_number}</b>
          <span className={styles.muted}>{batch.order_number || t("prodNoOrder")}</span>
        </div>
        <div className={styles.flatStats}>
          {MONITORING_METRICS.map(({ field, label }) => (
            <span key={field}>
              {t(label)}: <b>{fmtQty(batch[field])}</b>
            </span>
          ))}
        </div>
      </div>
    ))}
  </div>
);

// ── Стикеры ──────────────────────────────────────────────────────────────────

const CodeChip = ({ code, onCopy, t }) => (
  <button
    type="button"
    className={styles.codeChip}
    onClick={(e) => {
      e.stopPropagation();
      onCopy(code);
    }}
    aria-label={t("copyCode")}
  >
    <span>{code}</span>
    <IconCopy />
  </button>
);

const StickerCard = ({ row, t, canEdit, onOpen, onCopy, onEditRate, innerRef }) => {
  const editable = canEdit && row.status === "done" && !row.workers?.[0]?.hidden;
  return (
    <div ref={innerRef} className={styles.card} role="button" tabIndex={0} onClick={() => onOpen(row)} onKeyDown={(e) => e.key === "Enter" && onOpen(row)}>
      <div className={styles.cardHead}>
        <CodeChip code={row.sticker_code} onCopy={onCopy} t={t} />
        <StickerStatusBadge status={row.status} />
      </div>

      <div className={styles.cardTitleRow}>
        <div className={styles.cardTitleMain}>
          <h3 className={styles.cardTitle}>{row.operation_name}</h3>
          <p className={styles.cardSubtitle}>{[row.batch_number, row.product_name, row.size].filter(Boolean).join(" · ")}</p>
        </div>
      </div>

      {row.parent && (
        <div className={styles.prevInfo}>
          <span>
            {t("workStickerPrevSticker")}: <b>{row.parent.sticker_code}</b> · {row.parent.operation_name}
          </span>
        </div>
      )}

      {row.workers?.length > 0 && !row.workers[0].hidden && (
        <div className={styles.workers}>
          <EmployeeCell
            compact
            photo={row.workers[0].employeePhoto}
            fullName={row.workers[0].label}
            id={row.workers[0].employee_id}
            branch={row.workers[0].branchName}
            department={row.workers[0].departmentName}
            active={row.workers[0].employee_status !== false}
            previewable={false}
          />
          {row.workers.length > 1 && <span className={styles.moreWorkers}>+{row.workers.length - 1}</span>}
        </div>
      )}

      <div className={styles.tiles}>
        <Tile label={t("workStickerPlannedQuantity")} value={fmtQty(row.planned_qty)} tone={styles.tileMuted} />
        {row.status === "done" && <Tile label={t("prodDoneQty")} value={fmtQty(row.actual_qty)} tone={styles.tileGood} />}
        {row.defect_qty > 0 && <Tile label={t("prodScrapQty")} value={fmtQty(row.defect_qty)} tone={styles.tileBad} />}
        {row.rework_qty > 0 && <Tile label={t("prodReworkQty")} value={fmtQty(row.rework_qty)} tone={styles.tileWarn} />}
      </div>

      <div className={styles.moneyRow}>
        <div className={styles.money}>
          <span>{t("price")}</span>
          <b>{row.rate !== null ? fmtMoney(row.rate) : "—"}</b>
        </div>
        <div className={`${styles.money} ${styles.moneyTotal}`}>
          <span>{t("amount")}</span>
          <b>{row.amount !== null ? fmtMoney(row.amount) : "—"}</b>
        </div>
        {editable && (
          <button
            type="button"
            className={styles.editRateBtn}
            onClick={(e) => {
              e.stopPropagation();
              onEditRate(row);
            }}
            aria-label={t("prodRateEdit")}
          >
            <IconEdit />
          </button>
        )}
        <span className={styles.cardDate}>
          <IconClock />
          {fmtDateTime(row.added_at)}
        </span>
      </div>
    </div>
  );
};

// ── Страница ─────────────────────────────────────────────────────────────────

// Отчёт по производству в Telegram: пять вкладок из десктопной версии (по заказам,
// сотрудникам, операциям, стикерам и мониторинг) в виде карточек с вложенными
// шторками деталей — вместо больших таблиц. Данные каждой вкладки кэшируются и не
// перезапрашиваются при переключении, пока не поменяются фильтры или не сработает
// pull-to-refresh.
const ProductionReportPageTelegram = ({ routePath = "/production-report" }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const { filterOperationTypes } = useProductionAccess();
  const { canEdit } = usePermissionsTelegram(routePath);

  const [tab, setTab] = useState(TABS_ORDER[0]);
  const [filters, setFilters] = useState(defaultFilters);
  const [operationTypes, setOperationTypes] = useState([]);
  const [stickerAttrFilters, setStickerAttrFilters] = useState({ sizes: [], designs: [], materials: [], grammages: [] });
  const [reportState, setReportState] = useState(emptyReportState);

  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [draft, setDraft] = useState(filters[tab]);
  const [detail, setDetail] = useState(null); // { tab, row }
  const [rateModal, setRateModal] = useState({ open: false, rows: [] });

  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const requestIdRef = useRef({});
  const stickerStateRef = useRef(reportState.sticker);
  stickerStateRef.current = reportState.sticker;

  const orderPaneRef = useRef(null);
  const employeePaneRef = useRef(null);
  const operationPaneRef = useRef(null);
  const monitoringPaneRef = useRef(null);
  const stickerPaneRef = useRef(null);
  const stickerObserverRef = useRef(null);
  const searchTimerRef = useRef(null);

  const fetchTab = useCallback(
    async (targetTab, targetFilters, opts = {}) => {
      const { silent = false, page = 1, append = false } = opts;
      const requestId = (requestIdRef.current[targetTab] = (requestIdRef.current[targetTab] || 0) + 1);

      setReportState((prev) => ({
        ...prev,
        [targetTab]: {
          ...prev[targetTab],
          loading: !silent && !append ? true : prev[targetTab].loading,
          loadingMore: append ? true : prev[targetTab].loadingMore,
        },
      }));

      try {
        const params = { filters: JSON.stringify(targetFilters) };
        if (targetTab === "sticker") {
          params.page = page;
          params.pageSize = STICKER_PAGE_SIZE;
        }
        const res = await TAB_LOADERS[targetTab](params);
        if (requestIdRef.current[targetTab] !== requestId) return;

        setReportState((prev) => ({
          ...prev,
          [targetTab]: {
            data: append ? [...prev[targetTab].data, ...(res.data || [])] : res.data || [],
            totals: res.totals || null,
            pagination: res.pagination || null,
            loading: false,
            loadingMore: false,
            loaded: true,
            page,
            hasMore: targetTab === "sticker" ? page < (res.pagination?.totalPages || 1) : false,
          },
        }));
      } catch (error) {
        if (requestIdRef.current[targetTab] !== requestId) return;
        console.error("Ошибка при получении отчёта:", error.message);
        showAlert(t("errorLoading"), "error");
        setReportState((prev) => ({
          ...prev,
          [targetTab]: { ...prev[targetTab], loading: false, loadingMore: false, loaded: true },
        }));
      }
    },
    [showAlert, t],
  );

  useEffect(() => {
    getOperationTypes({ pageSize: 500 })
      .then((res) => setOperationTypes(res.data || []))
      .catch((error) => console.error("Ошибка при получении типов операций:", error.message));
    getProductionReportStickerItemAttributes()
      .then((data) =>
        setStickerAttrFilters({
          sizes: data?.sizes || [],
          designs: data?.designs || [],
          materials: data?.materials || [],
          grammages: data?.grammages || [],
        }),
      )
      .catch((error) => console.error("Ошибка при получении значений фильтра позиций:", error.message));
  }, []);

  // Вкладка открыта впервые — загружаем; повторное переключение показывает кэш.
  useEffect(() => {
    if (!reportState[tab].loaded) fetchTab(tab, filters[tab]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  usePullToRefresh(() => fetchTab("order", filtersRef.current.order, { silent: true }), orderPaneRef, reportState.order.loading);
  usePullToRefresh(() => fetchTab("employee", filtersRef.current.employee, { silent: true }), employeePaneRef, reportState.employee.loading);
  usePullToRefresh(() => fetchTab("operation", filtersRef.current.operation, { silent: true }), operationPaneRef, reportState.operation.loading);
  usePullToRefresh(() => fetchTab("monitoring", filtersRef.current.monitoring, { silent: true }), monitoringPaneRef, reportState.monitoring.loading);
  usePullToRefresh(() => fetchTab("sticker", filtersRef.current.sticker, { silent: true }), stickerPaneRef, reportState.sticker.loading);

  const stickerSentinelRef = useCallback(
    (node) => {
      if (stickerObserverRef.current) stickerObserverRef.current.disconnect();
      if (!node) return;
      stickerObserverRef.current = new IntersectionObserver(
        (entries) => {
          if (!entries[0].isIntersecting) return;
          const s = stickerStateRef.current;
          if (s.hasMore && !s.loadingMore) fetchTab("sticker", filtersRef.current.sticker, { page: s.page + 1, append: true });
        },
        { root: stickerPaneRef.current, rootMargin: "300px" },
      );
      stickerObserverRef.current.observe(node);
    },
    [fetchTab],
  );

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setFilters((prev) => ({ ...prev, [tab]: { ...prev[tab], search: value } }));
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      const next = { ...filtersRef.current[tab], search: value.trim() };
      setFilters((prev) => ({ ...prev, [tab]: next }));
      fetchTab(tab, next);
    }, 350);
  };

  const clearSearch = () => {
    clearTimeout(searchTimerRef.current);
    const next = { ...filtersRef.current[tab], search: "" };
    setFilters((prev) => ({ ...prev, [tab]: next }));
    fetchTab(tab, next);
  };

  const applyFilters = (next) => {
    setFilters((prev) => ({ ...prev, [tab]: next }));
    setFilterSheetOpen(false);
    fetchTab(tab, next);
  };

  const openFilterSheet = () => {
    setDraft(filters[tab]);
    setFilterSheetOpen(true);
  };

  const resetFilters = () => {
    const base = defaultFilters()[tab];
    applyFilters({ ...base, search: filters[tab].search });
  };

  const activeExtraCount = useMemo(() => {
    const f = filters[tab];
    let n = f.operation_type_id ? 1 : 0;
    if (tab === "sticker") {
      ["status", "size", "design", "material", "grammage"].forEach((key) => {
        if (f[key]) n++;
      });
    }
    return n;
  }, [filters, tab]);

  const openDetail = (detailTab, row) => setDetail({ tab: detailTab, row });
  const closeDetail = () => setDetail(null);

  const openRateEdit = (row) => setRateModal({ open: true, rows: [row] });
  const handleRateSaved = () => fetchTab("sticker", filtersRef.current.sticker, { silent: true });

  const handleCopy = async (code) => {
    try {
      await copyText(code);
      showAlert(t("copied"), "success");
    } catch {
      showAlert(t("error"), "error");
    }
  };

  const operationOptions = filterOperationTypes(operationTypes).map((o) => ({ value: String(o.id), label: o.name }));

  const orderTotals = reportState.order.totals;
  const employeeTotals = reportState.employee.totals;
  const operationTotals = reportState.operation.totals;
  const stickerTotals = reportState.sticker.totals;

  const monitoringCards = useMemo(() => {
    if (!reportState.monitoring.loaded) return [];
    return [
      ...reportState.monitoring.data.map((row) => ({ key: row.key, name: row.name, values: row, batches: row.batches })),
      { key: "total", name: t("total"), values: reportState.monitoring.totals || {}, total: true, batches: null },
    ];
  }, [reportState.monitoring, t]);

  const detailTitle = detail
    ? {
        order: detail.row.order_number || t("prodNoOrder"),
        employee: detail.row.label,
        operation: detail.row.name,
        monitoring: detail.row.name,
        sticker: detail.row.sticker_code,
      }[detail.tab]
    : "";

  return (
    <div className={styles.page}>
      <div className={styles.topGlass} />

      <header className={styles.head}>
        <h1 className={styles.title}>{t("production-report")}</h1>
        <div className={styles.tabsScroll} role="tablist">
          {TABS_ORDER.map((key) => {
            const Icon = TAB_ICONS[key];
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                className={`${styles.tabPill} ${tab === key ? styles.tabPillActive : ""}`}
                onClick={() => setTab(key)}
              >
                <Icon />
                <span>{t(TAB_TITLES[key])}</span>
              </button>
            );
          })}
        </div>
      </header>

      <div className={styles.stickyBar}>
        <label className={styles.searchBox}>
          <span className={styles.searchIcon}>
            <IconSearch />
          </span>
          <input
            type="search"
            value={filters[tab].search}
            onChange={handleSearchChange}
            placeholder={t("search")}
            enterKeyHint="search"
            autoComplete="off"
          />
          {filters[tab].search && (
            <button type="button" className={styles.clearBtn} onClick={clearSearch} aria-label="clear">
              <IconClose />
            </button>
          )}
        </label>

        <button
          type="button"
          className={`${styles.roundBtn} ${activeExtraCount > 0 ? styles.roundBtnActive : ""}`}
          onClick={openFilterSheet}
          aria-label={t("filters")}
        >
          <IconFilter />
          {activeExtraCount > 0 && <span className={styles.badge}>{activeExtraCount}</span>}
        </button>
      </div>

      <p className={styles.hint}>{t(TAB_HINTS[tab])}</p>

      <div className={styles.panes}>
        <div ref={orderPaneRef} className={`${styles.pane} ${tab === "order" ? "" : styles.paneHidden}`}>
          {orderTotals && reportState.order.data.length > 0 && (
            <KpiStrip
              items={[
                { label: t("prodBatchesCount"), value: orderTotals.batches_count },
                { label: t("prodBatchQty"), value: fmtQty(orderTotals.received_qty) },
                { label: t("prodDoneQty"), value: fmtQty(orderTotals.finished_qty), tone: styles.kpiGood },
                { label: t("prodSalary"), value: fmtMoney(orderTotals.amount), tone: styles.kpiAccent },
              ]}
            />
          )}
          <ReportList
            state={reportState.order}
            emptyIcon={<IconBox />}
            emptyText={t("noData")}
            renderItem={(row) => <OrderCard key={row.key} row={row} t={t} onOpen={(r) => openDetail("order", r)} />}
          />
        </div>

        <div ref={employeePaneRef} className={`${styles.pane} ${tab === "employee" ? "" : styles.paneHidden}`}>
          {employeeTotals && reportState.employee.data.length > 0 && (
            <KpiStrip
              items={[
                { label: t("prodStickers"), value: employeeTotals.stickers },
                { label: t("prodDoneQty"), value: fmtQty(employeeTotals.qty), tone: styles.kpiGood },
                { label: t("prodDeduction"), value: fmtMoney(employeeTotals.deduction), tone: styles.kpiBad },
                { label: t("prodSalary"), value: fmtMoney(employeeTotals.amount), tone: styles.kpiAccent },
              ]}
            />
          )}
          <ReportList
            state={reportState.employee}
            emptyIcon={<IconUsers />}
            emptyText={t("noData")}
            renderItem={(row) => <EmployeeCard key={row.key} row={row} t={t} onOpen={(r) => openDetail("employee", r)} />}
          />
        </div>

        <div ref={operationPaneRef} className={`${styles.pane} ${tab === "operation" ? "" : styles.paneHidden}`}>
          {operationTotals && reportState.operation.data.length > 0 && (
            <KpiStrip
              items={[
                { label: t("prodStickers"), value: operationTotals.stickers },
                { label: t("prodDoneQty"), value: fmtQty(operationTotals.qty), tone: styles.kpiGood },
                { label: t("prodSalary"), value: fmtMoney(operationTotals.amount), tone: styles.kpiAccent },
              ]}
            />
          )}
          <ReportList
            state={reportState.operation}
            emptyIcon={<IconSliders />}
            emptyText={t("noData")}
            renderItem={(row) => <OperationCard key={row.key} row={row} t={t} onOpen={(r) => openDetail("operation", r)} />}
          />
        </div>

        <div ref={monitoringPaneRef} className={`${styles.pane} ${tab === "monitoring" ? "" : styles.paneHidden}`}>
          {reportState.monitoring.loading && reportState.monitoring.data.length === 0 ? (
            <div className={styles.list}>
              {Array.from({ length: 3 }, (_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : reportState.monitoring.loaded && reportState.monitoring.data.length === 0 ? (
            <EmptyState icon={<IconTrend />} text={t("noData")} />
          ) : (
            <div className={styles.list}>
              {monitoringCards.map((card) => (
                <MonitoringCard key={card.key} card={card} t={t} onOpen={(c) => openDetail("monitoring", c)} />
              ))}
            </div>
          )}
        </div>

        <div ref={stickerPaneRef} className={`${styles.pane} ${tab === "sticker" ? "" : styles.paneHidden}`}>
          {stickerTotals && reportState.sticker.data.length > 0 && (
            <KpiStrip
              items={[
                { label: t("total"), value: stickerTotals.stickers },
                { label: t("workStickerPending"), value: stickerTotals.pending, tone: styles.kpiWarn },
                { label: t("workStickerDone"), value: stickerTotals.done, tone: styles.kpiGood },
                { label: t("prodScrapQty"), value: stickerTotals.scrapped, tone: styles.kpiBad },
              ]}
            />
          )}
          {reportState.sticker.loading && reportState.sticker.data.length === 0 ? (
            <div className={styles.list}>
              {Array.from({ length: 3 }, (_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : reportState.sticker.loaded && reportState.sticker.data.length === 0 ? (
            <EmptyState icon={<IconQr />} text={t("noData")} />
          ) : (
            <div className={styles.list}>
              {reportState.sticker.data.map((row, index) => (
                <StickerCard
                  key={row.id}
                  row={row}
                  t={t}
                  canEdit={canEdit}
                  onOpen={(r) => openDetail("sticker", r)}
                  onCopy={handleCopy}
                  onEditRate={openRateEdit}
                  innerRef={index === reportState.sticker.data.length - 3 ? stickerSentinelRef : null}
                />
              ))}
              {reportState.sticker.loadingMore && <MoreLoader />}
            </div>
          )}
        </div>
      </div>

      <TgSheet
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        title={t("filters")}
        subtitle={t(TAB_TITLES[tab])}
        footer={
          <div className={ui.btnRow}>
            <button type="button" className={`${ui.btn} ${ui.btnSecondary}`} onClick={resetFilters}>
              {t("clearAll")}
            </button>
            <button type="button" className={`${ui.btn} ${ui.btnPrimary}`} onClick={() => applyFilters(draft)}>
              {t("apply")}
            </button>
          </div>
        }
      >
        <div className={ui.form}>
          <div className={ui.grid2}>
            <div className={ui.field}>
              <label className={ui.label}>{t("dateFrom")}</label>
              <input
                type="date"
                className={ui.input}
                value={draft.date_from}
                onChange={(e) => setDraft((p) => ({ ...p, date_from: e.target.value }))}
              />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>{t("dateTo")}</label>
              <input
                type="date"
                className={ui.input}
                value={draft.date_to}
                onChange={(e) => setDraft((p) => ({ ...p, date_to: e.target.value }))}
              />
            </div>
          </div>

          <div className={ui.field}>
            <label className={ui.label}>{t("operationType")}</label>
            <SelectField
              value={draft.operation_type_id}
              onChange={(v) => setDraft((p) => ({ ...p, operation_type_id: v }))}
              options={operationOptions}
              allLabel={t("all")}
            />
          </div>

          {tab === "sticker" && (
            <>
              <div className={ui.field}>
                <label className={ui.label}>{t("status")}</label>
                <SelectField
                  value={draft.status}
                  onChange={(v) => setDraft((p) => ({ ...p, status: v }))}
                  options={Object.entries(STICKER_STATUS_KEYS).map(([value, key]) => ({ value, label: t(key) }))}
                  allLabel={t("all")}
                />
              </div>

              <div className={ui.grid2}>
                <div className={ui.field}>
                  <label className={ui.label}>{t("size")}</label>
                  <SelectField
                    value={draft.size}
                    onChange={(v) => setDraft((p) => ({ ...p, size: v }))}
                    options={stickerAttrFilters.sizes.map((v) => ({ value: v, label: v }))}
                    allLabel={t("all")}
                  />
                </div>
                <div className={ui.field}>
                  <label className={ui.label}>{t("grammage")}</label>
                  <SelectField
                    value={draft.grammage}
                    onChange={(v) => setDraft((p) => ({ ...p, grammage: v }))}
                    options={stickerAttrFilters.grammages.map((v) => ({ value: v, label: v }))}
                    allLabel={t("all")}
                  />
                </div>
              </div>

              <div className={ui.field}>
                <label className={ui.label}>{t("design")}</label>
                <SelectField
                  value={draft.design}
                  onChange={(v) => setDraft((p) => ({ ...p, design: v }))}
                  options={stickerAttrFilters.designs.map((v) => ({ value: v, label: v }))}
                  allLabel={t("all")}
                />
              </div>

              <div className={ui.field}>
                <label className={ui.label}>{t("material")}</label>
                <SelectField
                  value={draft.material}
                  onChange={(v) => setDraft((p) => ({ ...p, material: v }))}
                  options={stickerAttrFilters.materials.map((v) => ({ value: v, label: v }))}
                  allLabel={t("all")}
                />
              </div>
            </>
          )}
        </div>
      </TgSheet>

      <TgSheet isOpen={!!detail} onClose={closeDetail} title={detailTitle} subtitle={detail ? t(TAB_TITLES[detail.tab]) : ""}>
        {detail?.tab === "order" && <OrderDetailBody row={detail.row} t={t} />}
        {detail?.tab === "employee" && <EmployeeDetailBody row={detail.row} t={t} />}
        {detail?.tab === "operation" && <OperationDetailBody row={detail.row} t={t} />}
        {detail?.tab === "monitoring" && <MonitoringDetailBody card={detail.row} t={t} />}
        {detail?.tab === "sticker" && <StickerChronology stickerId={detail.row.id} />}
      </TgSheet>

      <StickerRateModal
        isOpen={rateModal.open}
        stickers={rateModal.rows}
        onClose={() => setRateModal({ open: false, rows: [] })}
        onSaved={handleRateSaved}
      />
    </div>
  );
};

export default ProductionReportPageTelegram;
