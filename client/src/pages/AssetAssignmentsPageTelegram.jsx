import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";

import {
  getAssetAssignments,
  getAssetAssignmentsByEmployee,
  getAssetAssignmentStats,
  deleteAssetAssignmentById,
  undoAssetAssignmentReturn,
  returnAssetAssignment,
} from "../api";
import { useAlertStore } from "../stores/alertStore";
import { usePermissionsTelegram } from "../hooks/usePermissionsTelegram";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { useScreenStack } from "../context/ScreenStackContext";
import { toneStyle, initialOf } from "../utils/attendanceTelegram";

import CenterModal from "../components/CenterModal";
import TgSheet from "../components/tg/TgSheet";
import AssetAssignmentFormScreenTelegram from "../components/AssetAssignmentFormScreenTelegram";
import ui from "../components/tg/TgUi.module.scss";
import {
  IconSearch,
  IconClose,
  IconPlus,
  IconBox,
  IconArrowRight,
  IconCheck,
  IconChevronDown,
  IconEdit,
  IconTrash,
  IconLogIn,
  IconLogOut,
  IconHash,
  IconCalendar,
  IconUser,
  IconMessage,
} from "../components/tg/tgIcons";

import styles from "./AssetAssignmentsPageTelegram.module.scss";

const PAGE_SIZE = 50;
const STATE_TONE = { assigned: "blue", returned: "green", scrapped: "red" };

const today = () => new Date().toISOString().slice(0, 10);

const formatDate = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU");
};

const fullNameOf = (person, fallback) =>
  [person?.last_name, person?.first_name].filter(Boolean).join(" ") || fallback;

// ── Аватар сотрудника ─────────────────────────────────────────────────────────

const Avatar = ({ photo, name, className, fallbackClassName }) => {
  const [failed, setFailed] = useState(false);
  const showPhoto = photo && !failed;

  return (
    <span className={className}>
      {showPhoto ? (
        <img
          src={`/api/employees/image/${photo}`}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={fallbackClassName}>{initialOf(name)}</span>
      )}
    </span>
  );
};

// ── Информационная строка в шторке ────────────────────────────────────────────

const InfoRow = ({ icon, label, value }) =>
  value ? (
    <li className={styles.infoRow}>
      <span className={styles.infoIcon}>{icon}</span>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoValue}>{value}</span>
    </li>
  ) : null;

// ── Карточка записи (вид «по имуществу») ──────────────────────────────────────

const AssignmentCard = ({ item, t, onOpen }) => {
  const emp = item.employee || {};
  const name = fullNameOf(emp, t("unknown"));
  const stateLabel = {
    assigned: t("stateAssigned"),
    returned: t("stateReturned"),
    scrapped: t("stateScrapped"),
  }[item.state] || item.state;

  return (
    <button
      type="button"
      className={styles.card}
      style={toneStyle(STATE_TONE[item.state] || "gray")}
      onClick={() => onOpen(item)}
    >
      <Avatar
        photo={emp.photo}
        name={name}
        className={styles.cardAvatar}
        fallbackClassName={styles.avatarFallback}
      />

      <span className={styles.cardBody}>
        <span className={styles.cardName}>{name}</span>
        <span className={styles.cardSub}>
          {[emp.position?.name, emp.department?.name].filter(Boolean).join(" · ") || "—"}
        </span>

        <span className={styles.cardChips}>
          <span className={styles.chip}>
            <IconBox />
            {item.asset_name}
            {item.quantity > 1 ? ` ×${item.quantity}` : ""}
          </span>
          <span className={styles.chip}>
            <IconCalendar />
            {formatDate(item.assigned_date)}
          </span>
        </span>
      </span>

      <span className={`${styles.statePill} ${styles[`state_${item.state}`] || ""}`}>
        {stateLabel}
      </span>
    </button>
  );
};

// ── Карточка сотрудника (вид «по сотрудникам») ────────────────────────────────

const EmployeeGroupCard = ({ emp, t, expanded, onToggle, onOpenItem }) => {
  const name = fullNameOf(emp, t("unknown"));
  const assets = emp.assetAssignments || [];
  const assignedCount = assets.filter((a) => a.state === "assigned").length;

  const stateLabel = {
    assigned: t("stateAssigned"),
    returned: t("stateReturned"),
    scrapped: t("stateScrapped"),
  };

  return (
    <div className={styles.groupCard}>
      <button type="button" className={styles.groupHead} onClick={() => onToggle(emp.id)}>
        <Avatar
          photo={emp.photo}
          name={name}
          className={styles.cardAvatar}
          fallbackClassName={styles.avatarFallback}
        />

        <span className={styles.cardBody}>
          <span className={styles.cardName}>{name}</span>
          <span className={styles.cardSub}>
            {[emp.department?.name, emp.branch?.name].filter(Boolean).join(" · ") || "—"}
          </span>
        </span>

        <span className={styles.groupCount}>
          {assignedCount}/{assets.length}
        </span>

        <span className={`${styles.chevron} ${expanded ? styles.chevronOpen : ""}`}>
          <IconChevronDown />
        </span>
      </button>

      {expanded && (
        <div className={styles.groupList}>
          {assets.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.groupItem}
              onClick={() => onOpenItem({ ...item, employee: emp })}
            >
              <span className={styles.groupItemName}>
                {item.asset_name}
                {item.quantity > 1 ? ` ×${item.quantity}` : ""}
              </span>
              <span className={styles.groupItemSub}>{formatDate(item.assigned_date)}</span>
              <span
                className={`${styles.statePillSm} ${styles[`state_${item.state}`] || ""}`}
              >
                {stateLabel[item.state] || item.state}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Шторка деталей записи ─────────────────────────────────────────────────────

const DetailSheet = ({ item, isOpen, onClose, canEdit, canDelete, t, onReturn, onUndo, onEdit, onDelete }) => {
  if (!item) return <TgSheet isOpen={isOpen} onClose={onClose} title="" />;

  const emp = item.employee || {};
  const name = fullNameOf(emp, t("unknown"));
  const stateLabel = {
    assigned: t("stateAssigned"),
    returned: t("stateReturned"),
    scrapped: t("stateScrapped"),
  }[item.state] || item.state;

  return (
    <TgSheet isOpen={isOpen} onClose={onClose} title={item.asset_name} subtitle={name}>
      <div className={styles.sheet} style={toneStyle(STATE_TONE[item.state] || "gray")}>
        <div className={styles.sheetTop}>
          <Avatar
            photo={emp.photo}
            name={name}
            className={styles.sheetAvatar}
            fallbackClassName={styles.avatarFallback}
          />
          <span className={`${styles.statePill} ${styles[`state_${item.state}`] || ""}`}>
            {stateLabel}
          </span>
        </div>

        <ul className={styles.info}>
          <InfoRow icon={<IconUser />} label={t("custodian")} value={name} />
          <InfoRow icon={<IconHash />} label={t("quantity")} value={item.quantity} />
          <InfoRow icon={<IconBox />} label={t("assetSpec")} value={item.asset_spec} />
          <InfoRow icon={<IconCheck />} label={t("assetCondition")} value={item.asset_condition} />
          <InfoRow icon={<IconHash />} label={t("inventoryNumber")} value={item.inventory_number} />
          <InfoRow
            icon={<IconCalendar />}
            label={t("assignedDate")}
            value={formatDate(item.assigned_date)}
          />
          {item.expected_return_date && (
            <InfoRow
              icon={<IconCalendar />}
              label={t("expectedReturnDate")}
              value={formatDate(item.expected_return_date)}
            />
          )}
          {item.state !== "assigned" && item.return_date && (
            <InfoRow
              icon={<IconCalendar />}
              label={t("returnDate")}
              value={formatDate(item.return_date)}
            />
          )}
          {item.state !== "assigned" && item.return_condition && (
            <InfoRow icon={<IconCheck />} label={t("returnCondition")} value={item.return_condition} />
          )}
          <InfoRow icon={<IconMessage />} label={t("note")} value={item.note} />
        </ul>

        {(canEdit || canDelete) && (
          <div className={styles.sheetActions}>
            {canEdit && item.state === "assigned" && (
              <div className={ui.btnRow}>
                <button
                  type="button"
                  className={`${ui.btn} ${ui.btnPrimary}`}
                  onClick={() => onReturn(item)}
                >
                  <IconLogOut />
                  {t("returnAsset")}
                </button>
              </div>
            )}
            {canEdit && item.state !== "assigned" && (
              <div className={ui.btnRow}>
                <button
                  type="button"
                  className={`${ui.btn} ${ui.btnSecondary}`}
                  onClick={() => onUndo(item)}
                >
                  <IconLogIn />
                  {t("undoReturn")}
                </button>
              </div>
            )}
            <div className={ui.btnRow}>
              {canEdit && (
                <button
                  type="button"
                  className={`${ui.btn} ${ui.btnSecondary}`}
                  onClick={() => onEdit(item)}
                >
                  <IconEdit />
                  {t("editBtn")}
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  className={`${ui.btn} ${ui.btnDanger}`}
                  onClick={() => onDelete(item)}
                >
                  <IconTrash />
                  {t("deleteBtn")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </TgSheet>
  );
};

// ── Шторка оформления возврата / списания ─────────────────────────────────────

const ReturnSheet = ({ item, isOpen, onClose, onSaved, t, showAlert }) => {
  const [state, setState] = useState("returned");
  const [returnDate, setReturnDate] = useState(today());
  const [condition, setCondition] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen || !item) return;
    setState("returned");
    setReturnDate(today());
    setCondition(item.asset_condition || "");
  }, [isOpen, item]);

  const submit = async () => {
    if (!returnDate) {
      showAlert(t("error"), "error");
      return;
    }

    setSaving(true);
    try {
      const res = await returnAssetAssignment(item.id, {
        state,
        return_date: returnDate,
        return_condition: condition.trim() || null,
      });

      if (res.success) {
        showAlert(t("success"), "success");
        onSaved?.();
        onClose();
      } else {
        showAlert(t("error"), "error");
      }
    } catch (error) {
      console.error("Ошибка при возврате имущества:", error);
      showAlert(error.response?.data?.error || t("error"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <TgSheet
      isOpen={isOpen}
      onClose={onClose}
      title={t("returnAsset")}
      subtitle={item?.asset_name}
      footer={
        <div className={ui.btnRow}>
          <button type="button" className={`${ui.btn} ${ui.btnSecondary}`} onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className={`${ui.btn} ${ui.btnPrimary}`}
            onClick={submit}
            disabled={saving}
          >
            {saving ? t("loading") : t("save")}
          </button>
        </div>
      }
    >
      {item && (
        <div className={ui.form}>
          <div className={ui.field}>
            <span className={ui.label}>{t("state")}</span>
            <div className={styles.stateSegment} role="tablist">
              {["returned", "scrapped"].map((s) => (
                <button
                  key={s}
                  type="button"
                  role="tab"
                  aria-selected={state === s}
                  className={`${styles.stateSegmentBtn} ${state === s ? styles.stateSegmentActive : ""}`}
                  onClick={() => setState(s)}
                >
                  {s === "returned" ? t("stateReturned") : t("stateScrapped")}
                </button>
              ))}
            </div>
          </div>

          <div className={ui.field}>
            <label className={ui.label} htmlFor="return-date">
              {t("returnDate")} <span className={ui.req}>*</span>
            </label>
            <input
              id="return-date"
              type="date"
              className={ui.input}
              min={item.assigned_date ? new Date(item.assigned_date).toISOString().slice(0, 10) : undefined}
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              onFocus={(e) => e.target.showPicker?.()}
            />
          </div>

          <div className={ui.field}>
            <label className={ui.label} htmlFor="return-condition">
              {t("returnCondition")}
            </label>
            <input
              id="return-condition"
              type="text"
              className={ui.input}
              value={condition}
              placeholder={t("assetConditionPlaceholder")}
              onChange={(e) => setCondition(e.target.value)}
            />
          </div>
        </div>
      )}
    </TgSheet>
  );
};

// ── Основная страница ─────────────────────────────────────────────────────────

const AssetAssignmentsPageTelegram = ({ routePath = "/asset-assignments" }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const { pushScreen } = useScreenStack();
  const { canAdd, canEdit, canDelete } = usePermissionsTelegram(routePath);

  const [view, setView] = useState("records"); // records | employees
  const [filter, setFilter] = useState("all"); // all | assigned | returned
  const [search, setSearch] = useState("");
  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedEmployees, setExpandedEmployees] = useState(() => new Set());

  const [detailItem, setDetailItem] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [returnItem, setReturnItem] = useState(null);
  const [undoId, setUndoId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const scrollRef = useRef(null);
  const viewRef = useRef(view);
  const filterRef = useRef(filter);
  const searchRef = useRef("");
  const searchTimerRef = useRef(null);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const requestIdRef = useRef(0);
  const observerRef = useRef(null);

  const fetchPage = useCallback(
    async (page = 1, silent = false) => {
      if (page > 1 && (loadingMoreRef.current || !hasMoreRef.current)) return;

      const requestId = ++requestIdRef.current;
      if (page === 1) {
        hasMoreRef.current = true;
        loadingMoreRef.current = false;
        setLoadingMore(false);
        if (!silent) setLoading(true);
      } else {
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }

      try {
        const loader =
          viewRef.current === "employees" ? getAssetAssignmentsByEmployee : getAssetAssignments;
        const { data: rows, pagination } = await loader({
          page,
          pageSize: PAGE_SIZE,
          filters: {
            search: searchRef.current,
            state: filterRef.current === "all" ? "" : filterRef.current,
            sort_by: "assigned_date",
            sort_order: "desc",
          },
        });
        if (requestId !== requestIdRef.current) return;

        const list = rows || [];
        setData((prev) => (page === 1 ? list : [...prev, ...list]));
        pageRef.current = page;
        hasMoreRef.current = page < (pagination?.totalPages || 1);
      } catch (error) {
        if (requestId !== requestIdRef.current) return;
        console.error("Ошибка при получении имущества:", error);
        showAlert(t("errorLoading"), "error");
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
          setLoadingMore(false);
          loadingMoreRef.current = false;
        }
      }
    },
    [showAlert, t],
  );

  const fetchStats = useCallback(async () => {
    try {
      const res = await getAssetAssignmentStats();
      if (res.success) setStats(res.data);
    } catch (error) {
      console.error("Ошибка при получении статистики имущества:", error);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchPage(1, true);
    fetchStats();
  }, [fetchPage, fetchStats]);

  useEffect(() => {
    fetchPage(1);
    fetchStats();
    return () => clearTimeout(searchTimerRef.current);
  }, []);

  usePullToRefresh(refreshAll, scrollRef, loading);

  const sentinelRef = useCallback(
    (node) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) fetchPage(pageRef.current + 1);
        },
        { root: scrollRef.current, rootMargin: "400px" },
      );
      observerRef.current.observe(node);
    },
    [fetchPage],
  );

  const changeSearch = (value) => {
    setSearch(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      searchRef.current = value.trim();
      fetchPage(1);
    }, 350);
  };

  const changeFilter = (value) => {
    if (value === filterRef.current) return;
    filterRef.current = value;
    setFilter(value);
    scrollRef.current?.scrollTo({ top: 0 });
    fetchPage(1);
  };

  const changeView = (value) => {
    if (value === viewRef.current) return;
    viewRef.current = value;
    setView(value);
    setExpandedEmployees(new Set());
    scrollRef.current?.scrollTo({ top: 0 });
    fetchPage(1);
  };

  const toggleEmployee = (id) =>
    setExpandedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openDetail = (item) => {
    setDetailItem(item);
    setDetailOpen(true);
  };

  const closeDetail = () => setDetailOpen(false);

  const openForm = (item) =>
    pushScreen(
      item ? `edit-assignment-${item.id}` : "add-assignment",
      <AssetAssignmentFormScreenTelegram editAssignment={item} onSaved={refreshAll} />,
    );

  const handleReturnSaved = () => {
    closeDetail();
    setReturnItem(null);
    refreshAll();
  };

  const handleUndo = async () => {
    const id = undoId;
    setUndoId(null);
    closeDetail();
    if (!id) return;
    try {
      await undoAssetAssignmentReturn(id);
      showAlert(t("success"), "success");
      refreshAll();
    } catch (error) {
      console.error("Ошибка при отмене возврата:", error);
      showAlert(error.response?.data?.error || t("error"), "error");
    }
  };

  const handleDelete = async () => {
    const id = deleteId;
    setDeleteId(null);
    closeDetail();
    if (!id) return;
    try {
      await deleteAssetAssignmentById(id);
      showAlert(t("success"), "success");
      refreshAll();
    } catch (error) {
      console.error("Ошибка при удалении имущества:", error);
      showAlert(error.response?.data?.error || t("error"), "error");
    }
  };

  const tiles = [
    {
      key: "all",
      label: t("statsAssetsTotal"),
      icon: <IconBox />,
      value: stats?.total,
      tone: styles.toneIndigo,
    },
    {
      key: "assigned",
      label: t("stateAssigned"),
      icon: <IconArrowRight />,
      value: stats?.assigned,
      tone: styles.toneBlue,
    },
    {
      key: "returned",
      label: t("stateReturned"),
      icon: <IconCheck />,
      value: stats?.returned,
      tone: styles.toneGreen,
    },
  ];

  const employeesCount = stats?.employees;

  return (
    <div className={styles.page}>
      <div className={styles.topGlass} />

      <div className={styles.main} id="scroll-container" ref={scrollRef}>
        <header className={styles.head}>
          <h1 className={styles.title}>{t("asset-assignments")}</h1>
        </header>

        <div className={styles.tiles} role="tablist">
          {tiles.map((tile) => (
            <button
              key={tile.key}
              type="button"
              role="tab"
              aria-selected={filter === tile.key}
              className={`${styles.tile} ${tile.tone} ${filter === tile.key ? styles.tileActive : ""}`}
              onClick={() => changeFilter(tile.key)}
            >
              <span className={styles.tileIcon}>{tile.icon}</span>
              <span className={styles.tileText}>
                <b className={styles.tileValue}>{tile.value ?? "–"}</b>
                <span className={styles.tileLabel}>{tile.label}</span>
              </span>
            </button>
          ))}
        </div>

        <div className={styles.toolbar}>
          <label className={styles.searchBox}>
            <span className={styles.searchIcon}>
              <IconSearch />
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => changeSearch(e.target.value)}
              placeholder={t("search")}
              enterKeyHint="search"
              autoComplete="off"
            />
            {search && (
              <button
                type="button"
                className={styles.clearBtn}
                onClick={() => changeSearch("")}
                aria-label="clear"
              >
                <IconClose />
              </button>
            )}
          </label>

          <div className={styles.viewSwitch} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={view === "records"}
              className={`${styles.viewBtn} ${view === "records" ? styles.viewBtnActive : ""}`}
              onClick={() => changeView("records")}
            >
              {t("viewByRecords")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "employees"}
              className={`${styles.viewBtn} ${view === "employees" ? styles.viewBtnActive : ""}`}
              onClick={() => changeView("employees")}
            >
              {t("viewByEmployees")}
              {employeesCount != null && (
                <span className={styles.viewBadge}>{employeesCount}</span>
              )}
            </button>
          </div>
        </div>

        <div className={styles.list}>
          {loading ? (
            Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={styles.skeleton}>
                <span className={styles.skAvatar} />
                <div className={styles.skLines}>
                  <span className={styles.skLine} style={{ width: "55%" }} />
                  <span className={styles.skLine} style={{ width: "35%" }} />
                  <span className={styles.skLine} style={{ width: "70%", height: 20 }} />
                </div>
              </div>
            ))
          ) : data.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>
                <IconBox />
              </span>
              <p>{t("noData")}</p>
            </div>
          ) : view === "employees" ? (
            data.map((emp, index) => (
              <div key={emp.id} ref={index === data.length - 5 ? sentinelRef : null}>
                <EmployeeGroupCard
                  emp={emp}
                  t={t}
                  expanded={expandedEmployees.has(emp.id)}
                  onToggle={toggleEmployee}
                  onOpenItem={openDetail}
                />
              </div>
            ))
          ) : (
            data.map((item, index) => (
              <div key={item.id} ref={index === data.length - 5 ? sentinelRef : null}>
                <AssignmentCard item={item} t={t} onOpen={openDetail} />
              </div>
            ))
          )}

          {loadingMore && (
            <div className={styles.moreLoader}>
              <span />
              <span />
              <span />
            </div>
          )}
        </div>
      </div>

      {canAdd && (
        <button
          type="button"
          className={styles.fab}
          onClick={() => openForm(null)}
          aria-label={t("assignAsset")}
        >
          <IconPlus />
        </button>
      )}

      <DetailSheet
        item={detailItem}
        isOpen={detailOpen}
        onClose={closeDetail}
        canEdit={canEdit}
        canDelete={canDelete}
        t={t}
        onReturn={(item) => setReturnItem(item)}
        onUndo={(item) => setUndoId(item.id)}
        onEdit={(item) => {
          closeDetail();
          openForm(item);
        }}
        onDelete={(item) => setDeleteId(item.id)}
      />

      <ReturnSheet
        item={returnItem}
        isOpen={!!returnItem}
        onClose={() => setReturnItem(null)}
        onSaved={handleReturnSaved}
        t={t}
        showAlert={showAlert}
      />

      <CenterModal
        isOpen={!!undoId}
        onClose={() => setUndoId(null)}
        onAccept={handleUndo}
        tag={t("undoReturn")}
        message={t("undoReturnConfirm")}
      />

      <CenterModal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onAccept={handleDelete}
        message={t("areYouSureDelete")}
      />
    </div>
  );
};

export default AssetAssignmentsPageTelegram;
