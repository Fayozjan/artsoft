import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import {
  getStockPickingById,
  confirmStockPicking,
  validateStockPicking,
  cancelStockPicking,
} from "../api";
import Loading from "./Loading";
import EmployeeCell from "./EmployeeCell";
import { Icons } from "../icons/icons";
import styles from "./StockPickingDetail.module.scss";

const STATE_META = {
  draft: { color: "#f59e0b", labelKey: "pickingStateDraft" },
  confirmed: { color: "#1455fe", labelKey: "pickingStateConfirmed" },
  done: { color: "#16a34a", labelKey: "pickingStateDone" },
  cancelled: { color: "#dd0303", labelKey: "pickingStateCancelled" },
};

const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
const fmtNum = (value) => (value === null || value === undefined || value === "" ? "—" : Number(value).toLocaleString("ru-RU"));

const StockPickingDetail = ({ id, canEdit, canDelete, onClose, onEdit, onDeleteRequest, onRefresh }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getStockPickingById(id);
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

  const runAction = async (action) => {
    setActionLoading(true);
    try {
      const res = await action(id);
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

  const meta = STATE_META[data.state] || STATE_META.draft;
  const isDraft = data.state === "draft";
  const isConfirmed = data.state === "confirmed";
  const isDone = data.state === "done";
  const isCancelled = data.state === "cancelled";
  const moves = data.moves || [];

  return (
    <div className={styles.detail}>
      {actionLoading && <Loading />}

      <div className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onClose}>
          {Icons.arrowBack}
          <span>{t("back")}</span>
        </button>
        <div className={styles.titleRow}>
          <h2>{data.name}</h2>
          <span className={styles.statusBadge} style={{ background: meta.color + "20", color: meta.color }}>
            {t(meta.labelKey)}
          </span>
        </div>
      </div>

      <div className={styles.meta}>
        <div className={styles.metaItem}>
          <span>{t("pickingType")}</span>
          <span>{data.type?.name || "—"}</span>
        </div>
        <div className={styles.metaItem}>
          <span>{t("pickingScheduledDate")}</span>
          <span>{fmtDate(data.scheduled_date)}</span>
        </div>
        <div className={styles.metaItem}>
          <span>{t("pickingFrom")}</span>
          <span>
            {data.srcPartner ? `${data.srcPartner.name} (${data.srcPartner.id})` : data.locationSrc?.name || "—"}
            {!data.srcPartner && data.locationSrc?.branch?.name && (
              <span className={styles.metaSub}>{data.locationSrc.branch.name}</span>
            )}
          </span>
        </div>
        <div className={styles.metaItem}>
          <span>{t("pickingTo")}</span>
          <span>
            {data.destPartner ? `${data.destPartner.name} (${data.destPartner.id})` : data.locationDest?.name || "—"}
            {!data.destPartner && data.locationDest?.branch?.name && (
              <span className={styles.metaSub}>{data.locationDest.branch.name}</span>
            )}
          </span>
        </div>
        {data.origin && (
          <div className={styles.metaItem}>
            <span>{t("pickingOrigin")}</span>
            <span>{data.origin}</span>
          </div>
        )}
        <div className={styles.metaItem}>
          <span>{t("currency")}</span>
          <span>{data.currency?.code || "—"}</span>
        </div>
        {!data.currency?.is_base && (
          <div className={styles.metaItem}>
            <span>{t("exchangeRate")}</span>
            <span>{fmtNum(data.rate)}</span>
          </div>
        )}
        {data.transport && (
          <div className={styles.metaItem}>
            <span>{t("pickingTransport")}</span>
            <span>{data.transport}</span>
          </div>
        )}
        {data.driver && (
          <div className={styles.metaItem}>
            <span>{t("pickingDriver")}</span>
            <span>{data.driver}</span>
          </div>
        )}
        {data.vehicle_number && (
          <div className={styles.metaItem}>
            <span>{t("pickingVehicleNumber")}</span>
            <span>{data.vehicle_number}</span>
          </div>
        )}
        {data.note && (
          <div className={styles.metaItem}>
            <span>{t("note")}</span>
            <span>{data.note}</span>
          </div>
        )}
      </div>

      <div className={styles.peopleRow}>
        <div className={styles.personBlock}>
          <div className={styles.personHead}>
            <span className={styles.personLabel}>{t("addedBy")}</span>
            <span className={styles.personDate}>{fmtDate(data.created_at)}</span>
          </div>
          {data.addedBy?.employee ? (
            <EmployeeCell
              compact
              alwaysShowBranch
              id={data.addedBy.employee_id}
              photo={data.addedBy.employee.photo}
              lastName={data.addedBy.employee.last_name}
              firstName={data.addedBy.employee.first_name}
              middleName={data.addedBy.employee.middle_name}
              branch={data.addedBy.employee.branch?.name}
              department={data.addedBy.employee.department?.name}
              position={data.addedBy.employee.position?.name}
            />
          ) : (
            <span className={styles.personFallback}>{data.addedBy?.username || "—"}</span>
          )}
        </div>
        {data.editedBy && (
          <div className={styles.personBlock}>
            <div className={styles.personHead}>
              <span className={styles.personLabel}>{t("pickingEditedBy")}</span>
              <span className={styles.personDate}>{fmtDate(data.edited_at)}</span>
            </div>
            {data.editedBy.employee ? (
              <EmployeeCell
                compact
                alwaysShowBranch
                id={data.editedBy.employee_id}
                photo={data.editedBy.employee.photo}
                lastName={data.editedBy.employee.last_name}
                firstName={data.editedBy.employee.first_name}
                middleName={data.editedBy.employee.middle_name}
                branch={data.editedBy.employee.branch?.name}
                department={data.editedBy.employee.department?.name}
                position={data.editedBy.employee.position?.name}
              />
            ) : (
              <span className={styles.personFallback}>{data.editedBy.username || "—"}</span>
            )}
          </div>
        )}
        {data.confirmedBy && (
          <div className={styles.personBlock}>
            <div className={styles.personHead}>
              <span className={styles.personLabel}>{t("pickingConfirmedBy")}</span>
              <span className={styles.personDate}>{fmtDate(data.confirmed_at)}</span>
            </div>
            {data.confirmedBy.employee ? (
              <EmployeeCell
                compact
                alwaysShowBranch
                id={data.confirmedBy.employee_id}
                photo={data.confirmedBy.employee.photo}
                lastName={data.confirmedBy.employee.last_name}
                firstName={data.confirmedBy.employee.first_name}
                middleName={data.confirmedBy.employee.middle_name}
                branch={data.confirmedBy.employee.branch?.name}
                department={data.confirmedBy.employee.department?.name}
                position={data.confirmedBy.employee.position?.name}
              />
            ) : (
              <span className={styles.personFallback}>{data.confirmedBy.username || "—"}</span>
            )}
          </div>
        )}
        {data.doneBy && (
          <div className={styles.personBlock}>
            <div className={styles.personHead}>
              <span className={styles.personLabel}>{t("pickingDoneBy")}</span>
              <span className={styles.personDate}>{fmtDate(data.date_done)}</span>
            </div>
            {data.doneBy.employee ? (
              <EmployeeCell
                compact
                alwaysShowBranch
                id={data.doneBy.employee_id}
                photo={data.doneBy.employee.photo}
                lastName={data.doneBy.employee.last_name}
                firstName={data.doneBy.employee.first_name}
                middleName={data.doneBy.employee.middle_name}
                branch={data.doneBy.employee.branch?.name}
                department={data.doneBy.employee.department?.name}
                position={data.doneBy.employee.position?.name}
              />
            ) : (
              <span className={styles.personFallback}>{data.doneBy.username || "—"}</span>
            )}
          </div>
        )}
      </div>

      <div className={styles.body}>
        <table>
          <thead>
            <tr>
              <th className={styles.numCol}>№</th>
              <th>{t("product")}</th>
              <th>{t("description")}</th>
              <th>{t("quantity")}</th>
              <th>{t("pickingQtyPackages")}</th>
              <th>{t("pickingQtyDone")}</th>
              <th>{t("unit")}</th>
              <th>{t("price")}{data.currency?.code ? `, ${data.currency.code}` : ""}</th>
              <th>{t("amount")}</th>
            </tr>
          </thead>
          <tbody>
            {moves.length > 0 ? (
              moves.map((m, i) => (
                <tr key={m.id}>
                  <td className={styles.numCol}>{i + 1}</td>
                  <td>
                    {m.product?.name || "—"}
                    {m.attributeValues?.length > 0 && (
                      <div className={styles.moveAttributes}>
                        {m.attributeValues.map((av) => `${av.attribute?.name}: ${av.attributeValue?.value}`).join(", ")}
                      </div>
                    )}
                  </td>
                  <td className={styles.moveNote}>{m.note || "—"}</td>
                  <td>{fmtNum(m.qty_demand)}</td>
                  <td>{fmtNum(m.qty_packages)}</td>
                  <td>{fmtNum(m.qty_done)}</td>
                  <td>{m.unit?.short_name || m.unit?.name || "—"}</td>
                  <td>{fmtNum(m.price_unit)}</td>
                  <td>{fmtNum((Number(m.qty_demand) || 0) * (Number(m.price_unit) || 0))}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9">{t("noData")}</td>
              </tr>
            )}
          </tbody>
          {moves.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan="8" className={styles.totalLabel}>{t("total")}</td>
                <td>
                  {fmtNum(moves.reduce((sum, m) => sum + (Number(m.qty_demand) || 0) * (Number(m.price_unit) || 0), 0))}
                  {data.currency?.code ? ` ${data.currency.code}` : ""}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className={styles.footer}>
        {canDelete && isDraft && (
          <button type="button" className={styles.danger} onClick={() => onDeleteRequest(data.id)} disabled={actionLoading}>
            {Icons.delete}
            <span>{t("delete")}</span>
          </button>
        )}
        {canEdit && isDraft && (
          <button type="button" onClick={onEdit} disabled={actionLoading}>
            {Icons.edit}
            <span>{t("edit")}</span>
          </button>
        )}
        {canEdit && !isCancelled && !isDraft && (
          <button type="button" className={styles.danger} onClick={() => runAction(cancelStockPicking)} disabled={actionLoading}>
            {Icons.undo}
            <span>{t(isDone ? "pickingCancelValidate" : "pickingCancelConfirm")}</span>
          </button>
        )}
        {canEdit && isDraft && (
          <button type="button" onClick={() => runAction(confirmStockPicking)} disabled={actionLoading}>
            {Icons.check}
            <span>{t("pickingConfirm")}</span>
          </button>
        )}
        {canEdit && isConfirmed && (
          <button type="button" className={styles.primary} onClick={() => runAction(validateStockPicking)} disabled={actionLoading || moves.length === 0}>
            {Icons.check}
            <span>{t("pickingValidate")}</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default StockPickingDetail;
