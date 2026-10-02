import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { usePermissions } from "../hooks/usePermissions";
import { getAuditLogs, getAuditEntities, getUsers } from "../api";
import Loading from "../components/Loading";
import Pagination from "../components/Pagination";
import OverlaySidebar from "../components/OverlaySidebar";
import SortArrow from "../components/SortArrow";
import { Icons } from "../icons/icons";
import styles from "./AuditLogsPage.module.scss";

const formatValue = (val) => {
  if (val === null || val === undefined) return <span className={styles.nullVal}>—</span>;
  if (typeof val === "boolean") return String(val);
  if (typeof val === "object") return <pre className={styles.inlineJson}>{JSON.stringify(val, null, 2)}</pre>;
  return String(val);
};

const DiffTable = ({ oldData, newData, action, t }) => {
  if (action === "update" && oldData && newData) {
    const norm = (v) => (v === undefined || v === null) ? null : v;
    const allKeys = [...new Set([...Object.keys(oldData), ...Object.keys(newData)])];
    const changedKeys = allKeys.filter(
      (k) => JSON.stringify(norm(oldData[k])) !== JSON.stringify(norm(newData[k])),
    );

    if (changedKeys.length === 0) {
      return <span className={styles.nullVal}>{t("auditNoChanges")}</span>;
    }

    return (
      <table className={styles.diffTable}>
        <thead>
          <tr>
            <th className={styles.diffFieldCol}>{t("auditField")}</th>
            <th>{t("auditOldValue")}</th>
            <th>{t("auditNewValue")}</th>
          </tr>
        </thead>
        <tbody>
          {changedKeys.map((key) => (
            <tr key={key} className={styles.changedRow}>
              <td className={`${styles.fieldName} ${styles.fieldNameChanged}`}>
                <span className={styles.changeDot} />
                {key}
              </td>
              <td className={styles.oldVal}>{formatValue(oldData[key])}</td>
              <td className={styles.newVal}>{formatValue(newData[key])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  const data = action === "delete" ? oldData : newData;
  if (!data) return <span className={styles.nullVal}>—</span>;

  return (
    <table className={styles.diffTable}>
      <thead>
        <tr>
          <th className={styles.diffFieldCol}>{t("auditField")}</th>
          <th>{t("auditValue")}</th>
        </tr>
      </thead>
      <tbody>
        {Object.entries(data).map(([key, val]) => (
          <tr key={key}>
            <td className={styles.fieldName}>{key}</td>
            <td>{formatValue(val)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const AuditLogsPage = () => {
  const { t } = useTranslation();
  const currentPath = window.location.pathname;
  usePermissions(currentPath);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [entities, setEntities] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");
  const [filters, setFilters] = useState({
    entity: "",
    action: "",
    user_id: "",
    date_from: "",
    date_to: "",
  });

  const fetchData = useCallback(
    async (page = 1, f = filters, size = pageSize) => {
      setLoading(true);
      try {
        const result = await getAuditLogs({
          page,
          pageSize: size,
          filters: JSON.stringify(f),
        });
        setData(result.data ?? []);
        setCurrentPage(result.pagination?.currentPage ?? 1);
        setTotalPages(result.pagination?.totalPages ?? 1);
        setTotalItems(result.pagination?.totalItems ?? 0);
      } catch (err) {
        console.error("auditLogs fetch error:", err);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchData(currentPage, filters, pageSize);
  }, [currentPage, pageSize]);

  useEffect(() => {
    getAuditEntities()
      .then((r) => setEntities(r.data ?? []))
      .catch(console.error);
    getUsers({ page: 1, pageSize: 1000 })
      .then((r) => setUsers(r.data ?? []))
      .catch(console.error);
  }, []);

  const userLabel = (user) =>
    user.employeeFullName || user.username;

  const handleSearch = () => {
    setCurrentPage(1);
    fetchData(1, filters, pageSize);
  };

  const handleReset = () => {
    const empty = { entity: "", action: "", user_id: "", date_from: "", date_to: "" };
    setFilters(empty);
    setCurrentPage(1);
    fetchData(1, empty, pageSize);
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const handleChangePageSize = (e) => {
    const size = parseInt(e.target.value, 10);
    setPageSize(size);
    setCurrentPage(1);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getSortedData = () => {
    if (!sortField) return data;
    return [...data].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (sortField === "added_at") {
        return sortOrder === "asc"
          ? new Date(aVal) - new Date(bVal)
          : new Date(bVal) - new Date(aVal);
      }

      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortOrder === "asc" ? aNum - bNum : bNum - aNum;
      }

      return sortOrder === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  };

  const countChanges = (row) => {
    if (row.action !== "update" || !row.old_data || !row.new_data) return null;
    const norm = (v) => (v === undefined || v === null) ? null : v;
    const keys = [...new Set([...Object.keys(row.old_data), ...Object.keys(row.new_data)])];
    const count = keys.filter((k) => JSON.stringify(norm(row.old_data[k])) !== JSON.stringify(norm(row.new_data[k]))).length;
    return count > 0 ? count : null;
  };

  return (
    <div className={styles.page}>
      {loading ? (
        <Loading />
      ) : (
        <div className={styles.main}>
          <div className={styles.mainHeader}>
            <div className={styles.filters}>
              <select
                value={filters.entity}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, entity: e.target.value }))
                }
              >
                <option value="">{t("auditEntity")} — {t("filterAll")}</option>
                {entities.map((ent) => (
                  <option key={ent} value={ent}>
                    {t(ent, { defaultValue: ent })}
                  </option>
                ))}
              </select>

              <select
                value={filters.action}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, action: e.target.value }))
                }
              >
                <option value="">{t("auditAction")} — {t("filterAll")}</option>
                <option value="create">{t("create")}</option>
                <option value="update">{t("update")}</option>
                <option value="delete">{t("delete")}</option>
              </select>

              <select
                value={filters.user_id}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, user_id: e.target.value }))
                }
              >
                <option value="">{t("auditUser")} — {t("filterAll")}</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {userLabel(user)}
                  </option>
                ))}
              </select>

              <input
                type="date"
                value={filters.date_from}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, date_from: e.target.value }))
                }
                className={styles.dateInput}
                title={t("dateFrom")}
              />

              <input
                type="date"
                value={filters.date_to}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, date_to: e.target.value }))
                }
                className={styles.dateInput}
                title={t("dateTo")}
              />

              <button className={styles.searchBtn} onClick={handleSearch}>
                {t("search")}
              </button>
              <button className={styles.resetBtn} onClick={handleReset}>
                {t("resetAllFilters")}
              </button>
            </div>

            <div className={styles.rightActions}>
              <Pagination
                currentPage={currentPage}
                pageSize={pageSize}
                totalItems={totalItems}
                totalPages={totalPages}
                handleChangePageSize={handleChangePageSize}
                handlePageChange={handlePageChange}
              />
              <div
                className={styles.refreshBtn}
                onClick={() => fetchData(currentPage, filters, pageSize)}
              >
                {Icons.refresh}
              </div>
            </div>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>№</th>
                  <th onClick={() => handleSort("entity")}>
                    <span className={styles.headerContent}>
                      {t("auditEntity")}
                      <SortArrow active={sortField === "entity"} order={sortOrder} />
                    </span>
                  </th>
                  <th onClick={() => handleSort("action")}>
                    <span className={styles.headerContent}>
                      {t("auditAction")}
                      <SortArrow active={sortField === "action"} order={sortOrder} />
                    </span>
                  </th>
                  <th onClick={() => handleSort("record_id")}>
                    <span className={styles.headerContent}>
                      {t("auditRecordId")}
                      <SortArrow active={sortField === "record_id"} order={sortOrder} />
                    </span>
                  </th>
                  <th onClick={() => handleSort("user_name")}>
                    <span className={styles.headerContent}>
                      {t("auditUser")}
                      <SortArrow active={sortField === "user_name"} order={sortOrder} />
                    </span>
                  </th>
                  <th onClick={() => handleSort("added_at")}>
                    <span className={styles.headerContent}>
                      {t("time")}
                      <SortArrow active={sortField === "added_at"} order={sortOrder} />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.length > 0 ? (
                  getSortedData().map((row, i) => {
                    const changes = countChanges(row);
                    return (
                      <tr
                        key={row.id}
                        className={styles.clickableRow}
                        onClick={() => setSelectedRow(row)}
                      >
                        <td>{(currentPage - 1) * pageSize + i + 1}</td>
                        <td>{t(row.entity, { defaultValue: row.entity })}</td>
                        <td>
                          <span
                            className={`${styles.actionBadge} ${styles[row.action]}`}
                          >
                            {t(row.action)}
                          </span>
                          {changes > 0 && (
                            <span className={styles.changeCount}>{changes}</span>
                          )}
                        </td>
                        <td>{row.record_id ?? "—"}</td>
                        <td>{row.user_name ?? "—"}</td>
                        <td>{formatDate(row.added_at)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6">{t("noData")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <OverlaySidebar
        isOpen={selectedRow !== null}
        onClose={() => setSelectedRow(null)}
        title={t("auditLogs")}
        width="900px"
      >
        {selectedRow && (
          <div className={styles.diffContainer}>
            <div className={styles.diffMeta}>
              <div className={styles.diffMetaRow}>
                <span className={styles.diffMetaLabel}>{t("auditEntity")}:</span>
                <span>{t(selectedRow.entity, { defaultValue: selectedRow.entity })}</span>
              </div>
              <div className={styles.diffMetaRow}>
                <span className={styles.diffMetaLabel}>{t("auditAction")}:</span>
                <span className={`${styles.actionBadge} ${styles[selectedRow.action]}`}>
                  {t(selectedRow.action)}
                </span>
              </div>
              <div className={styles.diffMetaRow}>
                <span className={styles.diffMetaLabel}>{t("auditRecordId")}:</span>
                <span>{selectedRow.record_id ?? "—"}</span>
              </div>
              <div className={styles.diffMetaRow}>
                <span className={styles.diffMetaLabel}>{t("auditUser")}:</span>
                <span>{selectedRow.user_name ?? "—"}</span>
              </div>
              <div className={styles.diffMetaRow}>
                <span className={styles.diffMetaLabel}>{t("auditIp")}:</span>
                <span>{selectedRow.ip_address ?? "—"}</span>
              </div>
              <div className={styles.diffMetaRow}>
                <span className={styles.diffMetaLabel}>{t("auditUserAgent")}:</span>
                <span title={selectedRow.user_agent ?? ""}>{selectedRow.user_agent ?? "—"}</span>
              </div>
              <div className={styles.diffMetaRow}>
                <span className={styles.diffMetaLabel}>{t("time")}:</span>
                <span>{formatDate(selectedRow.added_at)}</span>
              </div>
            </div>

            <div className={styles.diffBody}>
              <DiffTable
                t={t}
                oldData={selectedRow.old_data}
                newData={selectedRow.new_data}
                action={selectedRow.action}
              />
            </div>
          </div>
        )}
      </OverlaySidebar>
    </div>
  );
};

export default AuditLogsPage;
