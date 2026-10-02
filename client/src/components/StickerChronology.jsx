import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";

import { getProductionReportStickerChronology } from "../api";
import { useAlertStore } from "../stores/alertStore";
import { fmtQty } from "../utils/quantity";

import EmployeeCell from "./EmployeeCell";
import StickerStatusBadge from "./StickerStatusBadge";

import styles from "./StickerChronology.module.scss";

const RELATION_KEYS = {
  ancestor: "prodStickerRelationPrev",
  selected: "prodStickerRelationSelf",
  descendant: "prodStickerRelationNext",
};

const EVENT_KEYS = {
  created: "prodStickerEvtCreated",
  accepted: "prodStickerEvtAccepted",
  returned: "prodStickerEvtReturned",
  advanced: "prodStickerEvtAdvanced",
  child_deleted: "prodStickerEvtChildDeleted",
  rate_changed: "prodStickerEvtRateChanged",
  updated: "prodStickerEvtUpdated",
};

const SPLIT_KIND_KEYS = {
  normal: "workStickerNextOperation",
  rework: "workStickerSplitRework",
  incomplete: "workStickerSplitIncomplete",
  scrap: "workStickerSplitScrap",
};

const fmtMoney = (value) =>
  Number(value || 0).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDateTime = (value) => (value ? dayjs(value).format("DD.MM.YYYY HH:mm:ss") : "—");

const Chip = ({ label, children }) => (
  <span className={styles.chip}>
    {label && <span>{label}</span>}
    <b>{children}</b>
  </span>
);

// Хронология стикера: цепочка предыдущих стикеров → выбранный → дочерние, у каждого журнал
// (печать, приёмы, возвраты, раздача дальше). Данные тянет сама при раскрытии строки —
// журнал должен быть свежим.
const StickerChronology = ({ stickerId }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const [nodes, setNodes] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setNodes(null);
    getProductionReportStickerChronology(stickerId)
      .then((res) => {
        if (!cancelled) setNodes(res.nodes || []);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Ошибка при получении хронологии стикера:", error.message);
        setNodes([]);
        showAlert(t("error"), "error");
      });
    return () => {
      cancelled = true;
    };
  }, [stickerId]);

  const splitLabel = (kind) =>
    kind && kind !== "normal" && SPLIT_KIND_KEYS[kind] ? t(SPLIT_KIND_KEYS[kind]) : null;

  const renderWorker = (worker, index) => (
    <div className={styles.worker} key={`${worker.employee_id ?? "hidden"}-${index}`}>
      {worker.hidden ? (
        <span className={styles.muted}>—</span>
      ) : (
        <EmployeeCell
          compact
          photo={worker.employeePhoto}
          fullName={worker.label}
          id={worker.employee_id}
          branch={worker.branchName}
          department={worker.departmentName}
          active={worker.employee_status !== false}
        />
      )}
      <span className={styles.workerNums}>
        {fmtQty(worker.qty)}
        {worker.amount !== null && ` · ${fmtMoney(worker.amount)}`}
      </span>
    </div>
  );

  const renderChild = (child) => (
    <Chip key={child.id} label={child.sticker_code}>
      {[child.operation_name, fmtQty(child.planned_qty), splitLabel(child.split_kind)]
        .filter(Boolean)
        .join(" · ")}
    </Chip>
  );

  const renderEventDetails = (event) => {
    switch (event.type) {
      case "created":
        return (
          <div className={styles.chips}>
            <Chip label={t("workStickerPlannedQuantity")}>{fmtQty(event.planned_qty)}</Chip>
            {event.rate !== null && <Chip label={t("rate")}>{fmtMoney(event.rate)}</Chip>}
            {event.parent && (
              <Chip label={t("prodStickerCreatedFrom")}>
                {[event.parent.sticker_code, event.parent.operation_name, splitLabel(event.split_kind)]
                  .filter(Boolean)
                  .join(" · ")}
              </Chip>
            )}
          </div>
        );

      case "accepted":
      case "returned": {
        const done = event.workers.reduce((sum, worker) => sum + worker.qty, 0);
        return (
          <>
            <div className={styles.workers}>{event.workers.map(renderWorker)}</div>
            <div className={styles.chips}>
              <Chip label={t("workStickerActualQuantity")}>{fmtQty(done)}</Chip>
              {event.defect_qty > 0 && (
                <Chip label={t("workStickerDefectQuantity")}>{fmtQty(event.defect_qty)}</Chip>
              )}
              {event.rework_qty > 0 && (
                <Chip label={t("workStickerReworkQuantity")}>{fmtQty(event.rework_qty)}</Chip>
              )}
              {event.incomplete_qty > 0 && (
                <Chip label={t("workStickerIncompleteQuantity")}>{fmtQty(event.incomplete_qty)}</Chip>
              )}
              {event.rate !== null && <Chip label={t("rate")}>{fmtMoney(event.rate)}</Chip>}
              {event.amount !== null && <Chip label={t("amount")}>{fmtMoney(event.amount)}</Chip>}
              {event.comment && <Chip label={t("comment")}>{event.comment}</Chip>}
            </div>
          </>
        );
      }

      case "advanced":
        return (
          <div className={styles.chips}>
            {event.children.length > 0 ? (
              event.children.map(renderChild)
            ) : (
              <span className={styles.muted}>{t("prodStickerNoChildren")}</span>
            )}
          </div>
        );

      case "rate_changed":
        return (
          <div className={styles.chips}>
            <Chip label={t("rate")}>
              {event.old_rate === null ? "—" : fmtMoney(event.old_rate)} →{" "}
              {event.rate === null ? "—" : fmtMoney(event.rate)}
            </Chip>
          </div>
        );

      case "child_deleted":
        return (
          <div className={styles.chips}>
            {renderChild(event.child)}
            <StickerStatusBadge status={event.child.status} />
          </div>
        );

      default:
        return null;
    }
  };

  const renderNode = (node) => (
    <div
      key={node.id}
      className={`${styles.node} ${node.relation === "selected" ? styles.nodeSelected : ""}`}
      style={{ "--depth": node.depth }}
    >
      <div className={styles.nodeHead}>
        <span className={styles.relation}>{t(RELATION_KEYS[node.relation])}</span>
        <b className={styles.code}>{node.sticker_code}</b>
        <span className={styles.operation}>{node.operation_name}</span>
        <StickerStatusBadge status={node.status} />
        {node.split_kind && splitLabel(node.split_kind) && (
          <span className={styles.muted}>{splitLabel(node.split_kind)}</span>
        )}
      </div>

      <div className={styles.chips}>
        <Chip label={t("workStickerPlannedQuantity")}>{fmtQty(node.planned_qty)}</Chip>
        {node.status === "done" && (
          <Chip label={t("workStickerActualQuantity")}>{fmtQty(node.actual_qty)}</Chip>
        )}
        {node.scanned_by && <Chip label={t("prodStickerScannedBy")}>{node.scanned_by}</Chip>}
        {node.defect_qty > 0 && (
          <Chip label={t("workStickerDefectQuantity")}>{fmtQty(node.defect_qty)}</Chip>
        )}
        {node.rework_qty > 0 && (
          <Chip label={t("workStickerReworkQuantity")}>{fmtQty(node.rework_qty)}</Chip>
        )}
        {node.incomplete_qty > 0 && (
          <Chip label={t("workStickerIncompleteQuantity")}>{fmtQty(node.incomplete_qty)}</Chip>
        )}
        {node.amount !== null && <Chip label={t("amount")}>{fmtMoney(node.amount)}</Chip>}
        {node.comment && <Chip label={t("comment")}>{node.comment}</Chip>}
      </div>

      <ol className={styles.events}>
        {node.events.map((event, index) => (
          <li key={`${event.type}-${event.at}-${index}`} className={`${styles.event} ${styles[event.type]}`}>
            <div className={styles.eventHead}>
              <span className={styles.eventTitle}>{t(EVENT_KEYS[event.type])}</span>
              <span className={styles.eventMeta}>
                {fmtDateTime(event.at)}
                {event.user && ` · ${event.user}`}
              </span>
            </div>
            {renderEventDetails(event)}
          </li>
        ))}
      </ol>
    </div>
  );

  if (nodes === null) return <div className={styles.state}>{t("loading")}…</div>;
  if (nodes.length === 0) return <div className={styles.state}>{t("noData")}</div>;

  return <div className={styles.chain}>{nodes.map(renderNode)}</div>;
};

export default StickerChronology;
