import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { getOperationById, acceptOperation, revertOperation } from "../api";

import Loading from "./Loading";
import { Icons } from "../icons/icons";
import styles from "./OperationDetail.module.scss";

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ru-RU");
};

const STATUS_META = {
  draft: { color: "#f59e0b", labelKey: "draft" },
  accepted: { color: "#16a34a", labelKey: "accepted" },
};

const MetaCard = ({ label, value }) => (
  <div className={styles.metaCard}>
    <span className={styles.metaLabel}>{label}</span>
    <span className={styles.metaValue}>{value}</span>
  </div>
);

const employeeName = (employee) =>
  employee ? [employee.last_name, employee.first_name].filter(Boolean).join(" ") : "—";

const OperationDetail = ({ id, canEdit, canDelete, onClose, onEdit, onDeleteRequest, onRefresh }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getOperationById(id);
      setData(res.data);
    } catch (err) {
      console.error(err);
      showAlert(t("error"), "error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAccept = async () => {
    setActionLoading(true);
    try {
      const res = await acceptOperation(id);
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
      const res = await revertOperation(id);
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

  if (loading) return <Loading />;
  if (!data) return null;

  const meta = STATUS_META[data.status] || STATUS_META.draft;
  const isDraft = data.status === "draft";
  const items = data.items || [];
  const totalAmount = items.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <div className={styles.detail}>
      {actionLoading && <Loading />}

      <div className={styles.header}>
        <div className={styles.headerText}>
          <span className={styles.headerEyebrow}>{t("operationDetails")}</span>
          <div className={styles.headerTitleRow}>
            <h2>{data.document_number}</h2>
            <span
              className={styles.statusBadge}
              style={{ background: meta.color + "20", color: meta.color }}
            >
              {t(meta.labelKey)}
            </span>
          </div>
        </div>
        <span onClick={onClose} style={{ display: "flex", cursor: "pointer" }}>
          {Icons.clear}
        </span>
      </div>

      <div className={styles.body}>
        <div className={styles.section}>
          <div className={styles.metaGrid}>
            <MetaCard label={t("date")} value={formatDate(data.operation_date)} />
            <MetaCard label={t("customerOrderNumber")} value={data.order_number || "—"} />
            <MetaCard label={t("totalAmount")} value={totalAmount.toFixed(2)} />
          </div>
        </div>

        {data.comment && (
          <div className={styles.section}>
            <div className={styles.commentBlock}>
              <span className={styles.infoLabel}>{t("comment")}</span>
              <p>{data.comment}</p>
            </div>
          </div>
        )}

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>{t("lineItems")}</h3>
            <span className={styles.itemsCount}>{items.length}</span>
          </div>

          <div className={styles.itemsTableWrap}>
            <table className={styles.itemsTable}>
              <thead>
                <tr>
                  <th>{t("employee")}</th>
                  <th>{t("operationType")}</th>
                  <th style={{ textAlign: "right" }}>{t("quantity")}</th>
                  <th style={{ textAlign: "right" }}>{t("rate")}</th>
                  <th style={{ textAlign: "right" }}>{t("amount")}</th>
                  <th>{t("comment")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{employeeName(item.employee)}</td>
                    <td>{item.operationType?.name || "—"}</td>
                    <td style={{ textAlign: "right" }}>{item.quantity}</td>
                    <td style={{ textAlign: "right" }}>{item.rate}</td>
                    <td style={{ textAlign: "right" }}>{item.amount}</td>
                    <td>{item.comment || "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>{t("totalAmount")}</td>
                  <td style={{ textAlign: "right" }}>{totalAmount.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <div className={styles.footer}>
        {canDelete && isDraft && (
          <button
            className={styles.btnDanger}
            onClick={() => onDeleteRequest(data.id)}
          >
            {t("delete")}
          </button>
        )}
        {canEdit && isDraft && (
          <button className={styles.btnMuted} onClick={onEdit}>
            {t("edit")}
          </button>
        )}
        {canEdit && isDraft && (
          <button className={styles.btnPrimary} onClick={handleAccept} disabled={actionLoading}>
            {t("acceptDocument")}
          </button>
        )}
        {canEdit && !isDraft && (
          <button className={styles.btnMuted} onClick={handleRevert}>
            {t("revertToDraft")}
          </button>
        )}
      </div>
    </div>
  );
};

export default OperationDetail;
