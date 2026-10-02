import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { usePermissions } from "../hooks/usePermissions";
import { getCronTasks, deleteCronTask, toggleCronTask } from "../api";
import { useAlertStore } from "../stores/alertStore";

import Loading from "../components/Loading";
import AddCronTask from "../components/AddCronTask";
import EditCronTask from "../components/EditCronTask";
import Button from "../components/Button";
import CenterModal from "../components/CenterModal";
import OverlaySidebar from "../components/OverlaySidebar";
import { ActionCell } from "../components/ActionButtons";
import SortArrow from "../components/SortArrow";
import { getCronTaskType } from "../components/cronTaskConfigs/registry";
import { Icons } from "../icons/icons";

import styles from "./CronTasksPage.module.scss";
import badgeStyles from "../components/Badge.module.scss";

const DAY_LABELS = { 1: "dayMon", 2: "dayTue", 3: "dayWed", 4: "dayThu", 5: "dayFri", 6: "daySat", 7: "daySun" };

const formatSchedule = (item, t) => {
  if (item.schedule_kind === "interval") {
    return t("everyNMinutes", { minutes: item.interval_minutes ?? 0 });
  }
  const days = [...(item.days_of_week || [])]
    .sort((a, b) => a - b)
    .map((d) => t(DAY_LABELS[d]) || d)
    .join(",");
  const time = `${String(item.hour ?? 0).padStart(2, "0")}:${String(item.minute ?? 0).padStart(2, "0")}`;
  return `${days} ${time}`;
};

const formatConfigSummary = (item, t) => getCronTaskType(item.task_type)?.summary(item.config, t) || "";

const lastRunClass = (status) => {
  if (status === "error") return styles.lastRunError;
  if (status === "running") return styles.lastRunRunning;
  return styles.lastRunSuccess;
};

const CronTasksPage = () => {
  const { showAlert } = useAlertStore();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [modalType, setModalType] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");
  const { t } = useTranslation();

  const currentPath = window.location.pathname;
  const { canAdd, canEdit, canDelete } = usePermissions(currentPath);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getCronTasks();
      setData(res.data || []);
    } catch (err) {
      console.error("Ошибка при загрузке крон-задач:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEditClick = (id) => {
    setSelectedItem(id);
    setModalType("edit");
  };

  const handleDeleteClick = (itemId) => {
    setSelectedItem(itemId);
    setShowModal(true);
  };

  const handleDelete = async (itemId) => {
    try {
      await deleteCronTask(itemId);
      showAlert(t("success"), "success");
      setShowModal(false);
      fetchData();
    } catch (err) {
      console.error("Ошибка при удалении:", err);
      showAlert(t("error"), "error");
    }
  };

  const handleToggle = async (item) => {
    try {
      await toggleCronTask(item.id);
      fetchData();
    } catch (err) {
      console.error("Ошибка переключения статуса:", err);
      showAlert(t("error"), "error");
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const getSortValue = (item, field) => {
    switch (field) {
      case "task_type":
        return t(getCronTaskType(item.task_type)?.labelKey || item.task_type);
      case "configSummary":
        return formatConfigSummary(item, t);
      case "schedule":
        return formatSchedule(item, t);
      default:
        return item[field];
    }
  };

  const getSortedData = () => {
    if (!sortField) return data;
    return [...data].sort((a, b) => {
      const aVal = getSortValue(a, sortField);
      const bVal = getSortValue(b, sortField);

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (sortField === "last_run_at") {
        return sortOrder === "asc"
          ? new Date(aVal) - new Date(bVal)
          : new Date(bVal) - new Date(aVal);
      }

      if (typeof aVal === "boolean" && typeof bVal === "boolean") {
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }

      return sortOrder === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  };

  return (
    <div className={styles.cronTasksPage}>
      {loading ? (
        <Loading />
      ) : (
        <div className={styles.main}>
          <div className={styles.mainHeader}>
            <div className={styles.buttonsWrapper}>
              {canAdd && <Button text={t("add")} onClick={() => setModalType("add")} />}
              <div className={styles.refreshBtn} onClick={() => fetchData()}>
                {Icons.refresh}
              </div>
            </div>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>№</th>
                  <th onClick={() => handleSort("name")}>
                    <span className={styles.headerContent}>
                      {t("name")}
                      <SortArrow active={sortField === "name"} order={sortOrder} />
                    </span>
                  </th>
                  <th onClick={() => handleSort("task_type")}>
                    <span className={styles.headerContent}>
                      {t("taskType")}
                      <SortArrow active={sortField === "task_type"} order={sortOrder} />
                    </span>
                  </th>
                  <th onClick={() => handleSort("configSummary")}>
                    <span className={styles.headerContent}>
                      {t("configSummary")}
                      <SortArrow active={sortField === "configSummary"} order={sortOrder} />
                    </span>
                  </th>
                  <th onClick={() => handleSort("schedule")}>
                    <span className={styles.headerContent}>
                      {t("schedule")}
                      <SortArrow active={sortField === "schedule"} order={sortOrder} />
                    </span>
                  </th>
                  <th onClick={() => handleSort("status")}>
                    <span className={styles.headerContent}>
                      {t("status")}
                      <SortArrow active={sortField === "status"} order={sortOrder} />
                    </span>
                  </th>
                  <th onClick={() => handleSort("last_run_at")}>
                    <span className={styles.headerContent}>
                      {t("lastRun")}
                      <SortArrow active={sortField === "last_run_at"} order={sortOrder} />
                    </span>
                  </th>
                  {(canEdit || canDelete) && <th>{t("action")}</th>}
                </tr>
              </thead>
              <tbody>
                {data.length > 0 ? (
                  getSortedData().map((item, i) => (
                    <tr key={item.id}>
                      <td>{i + 1}</td>
                      <td>{item.name}</td>
                      <td>{t(getCronTaskType(item.task_type)?.labelKey || item.task_type)}</td>
                      <td>{formatConfigSummary(item, t)}</td>
                      <td>{formatSchedule(item, t)}</td>
                      <td>
                        <span
                          className={item.status ? badgeStyles.active : badgeStyles.inactive}
                          style={{ cursor: canEdit ? "pointer" : "default" }}
                          onClick={() => canEdit && handleToggle(item)}
                        >
                          {item.status ? t("cronStatusActive") : t("cronStatusInactive")}
                        </span>
                      </td>
                      <td>
                        {item.last_run_at ? (
                          <span
                            className={lastRunClass(item.last_run_status)}
                            title={item.last_run_error || ""}
                          >
                            {item.last_run_status === "running"
                              ? t("cronRunning")
                              : new Date(item.last_run_at).toLocaleString()}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <ActionCell
                        item={item}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        onEdit={handleEditClick}
                        onDelete={handleDeleteClick}
                      />
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="11">{t("noData")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CenterModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onAccept={() => handleDelete(selectedItem)}
        title={t("areYouSureDelete")}
      />
      <OverlaySidebar
        isOpen={modalType !== null}
        onClose={() => setModalType(null)}
        title={modalType === "add" ? t("addCronTask") : t("editCronTask")}
        width="440px"
      >
        {modalType === "add" && (
          <AddCronTask handleClose={() => setModalType(null)} onSuccess={fetchData} />
        )}
        {modalType === "edit" && (
          <EditCronTask id={selectedItem} handleClose={() => setModalType(null)} onSuccess={fetchData} />
        )}
      </OverlaySidebar>
    </div>
  );
};

export default CronTasksPage;
