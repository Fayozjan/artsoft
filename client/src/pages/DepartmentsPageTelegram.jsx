import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  getDepartments,
  deleteDepartmentById,
  getActiveBranches,
} from "../api";
import { getDepartmentsStaffingOverview } from "../api/departments";
import { useAlertStore } from "../stores/alertStore";
import { usePermissionsTelegram } from "../hooks/usePermissionsTelegram";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { useHideBranch } from "../hooks/useHideBranch";
import { useScreenStack } from "../context/ScreenStackContext";

import CenterModal from "../components/CenterModal";
import DepartmentFormScreenTelegram from "../components/DepartmentFormScreenTelegram";
import {
  IconSearch,
  IconClose,
  IconPlus,
  IconTrash,
  IconCheck,
  IconBuilding,
  IconMapPin,
  IconUsers,
  IconBriefcase,
  IconChevronRight,
} from "../components/tg/tgIcons";

import styles from "./DepartmentsPageTelegram.module.scss";

const PAGE_SIZE = 50;

const STATUS_PARAM = { all: "", active: "true", inactive: "false" };

const ALL_BRANCHES = "";

const SkeletonCard = () => (
  <div className={styles.skeleton}>
    <div className={styles.skLines}>
      <span className={styles.skLine} style={{ width: "55%", height: 16 }} />
      <span className={styles.skLine} style={{ width: "35%" }} />
    </div>
    <span className={styles.skLine} style={{ width: "70%", height: 22 }} />
    <span className={styles.skLine} style={{ width: "100%", height: 6 }} />
  </div>
);

const DepartmentCard = ({
  item,
  staffing,
  hideBranch,
  canEdit,
  canDelete,
  onOpen,
  onDelete,
  innerRef,
  t,
}) => {
  const active = item.status === true || item.status === "active";
  const planned = staffing?.planned || 0;
  const actual = staffing?.actual || 0;
  const vacancies = staffing?.vacancies || 0;
  const percent = planned > 0 ? Math.min(100, (actual / planned) * 100) : 0;
  const over = planned > 0 && actual > planned;
  const full = planned > 0 && actual === planned;

  return (
    <div
      ref={innerRef}
      className={`${styles.card} ${active ? "" : styles.cardOff} ${canEdit ? styles.cardTappable : ""}`}
      role={canEdit ? "button" : undefined}
      tabIndex={canEdit ? 0 : undefined}
      onClick={() => canEdit && onOpen(item.id)}
      onKeyDown={(e) => canEdit && e.key === "Enter" && onOpen(item.id)}
    >
      <div className={styles.cardTop}>
        <div className={styles.who}>
          <h3 className={styles.name}>{item.name}</h3>
          <p className={styles.sub}>
            {!hideBranch && item.branch?.name && (
              <span className={styles.branch}>
                <IconMapPin />
                <span>{item.branch.name}</span>
              </span>
            )}
            <em>#{item.id}</em>
          </p>
        </div>

        {canDelete ? (
          <button
            type="button"
            className={styles.trashBtn}
            aria-label={t("delete")}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
          >
            <IconTrash />
          </button>
        ) : (
          canEdit && (
            <span className={styles.chevron}>
              <IconChevronRight />
            </span>
          )
        )}
      </div>

      <div className={styles.chips}>
        <span className={`${styles.chip} ${active ? styles.chipGreen : styles.chipRed}`}>
          <i />
          {active ? t("enabled") : t("disabled")}
        </span>
        <span
          className={`${styles.chip} ${styles.chipBlue}`}
          title={t("employees")}
        >
          <IconUsers />
          {item.employees_count ?? 0}
        </span>
        {vacancies > 0 && (
          <span className={`${styles.chip} ${styles.chipAmber}`}>
            <IconBriefcase />
            {vacancies} {t("vacancies")}
          </span>
        )}
      </div>

      {planned > 0 && (
        <div className={styles.meter}>
          <div className={styles.meterHead}>
            <span>{t("staffing")}</span>
            <b className={over ? styles.metricOver : full ? styles.metricFull : ""}>
              {actual}
              <small> / {planned}</small>
            </b>
          </div>
          <div className={styles.meterTrack}>
            <span
              className={`${styles.meterFill} ${over ? styles.fillOver : full ? styles.fillFull : ""}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Страница «Отдел кадров → Отделы» в Telegram: сводка-фильтр, поиск, фильтр по
// филиалу и карточки отделов со штатной укомплектованностью.
// Добавление и правка открываются экраном поверх (стек экранов), как у логинов.
const DepartmentsPageTelegram = ({ routePath = "/departments" }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const { pushScreen } = useScreenStack();
  const { canAdd, canEdit, canDelete } = usePermissionsTelegram(routePath);
  // при работе в одном филиале свой выбор филиала прячем
  const hideBranch = useHideBranch();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [branchId, setBranchId] = useState(ALL_BRANCHES);
  const [branches, setBranches] = useState([]);
  const [counts, setCounts] = useState({ all: null, active: null });
  const [staffingMap, setStaffingMap] = useState({});
  const [deleteId, setDeleteId] = useState(null);

  const scrollRef = useRef(null);
  const searchRef = useRef("");
  const filterRef = useRef("all");
  const branchRef = useRef(ALL_BRANCHES);
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
        const { data: rows, pagination } = await getDepartments({
          page,
          pageSize: PAGE_SIZE,
          filters: {
            search: searchRef.current,
            status: STATUS_PARAM[filterRef.current],
            branch_id: branchRef.current,
          },
        });
        // ответ устаревшего запроса (успели сменить поиск/фильтр) — выбрасываем
        if (requestId !== requestIdRef.current) return;

        const list = rows || [];
        setData((prev) => (page === 1 ? list : [...prev, ...list]));
        pageRef.current = page;
        hasMoreRef.current = page < (pagination?.totalPages || 1);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        console.error("Ошибка при получении отделов:", err);
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

  // Счётчики плиток — без учёта поиска, иначе цифры «прыгают» при вводе запроса.
  const fetchCounts = useCallback(async () => {
    try {
      const branch_id = branchRef.current;
      const [all, active] = await Promise.all([
        getDepartments({ page: 1, pageSize: 1, filters: { branch_id } }),
        getDepartments({
          page: 1,
          pageSize: 1,
          filters: { branch_id, status: "true" },
        }),
      ]);
      setCounts({
        all: all.pagination?.totalItems ?? 0,
        active: active.pagination?.totalItems ?? 0,
      });
    } catch (err) {
      console.error("Ошибка при получении счётчиков:", err);
    }
  }, []);

  // Штат по отделам: план / факт / вакансии. Нужен только для шкалы на карточке —
  // если не загрузился, карточки просто показываются без неё.
  const fetchStaffing = useCallback(async () => {
    try {
      const res = await getDepartmentsStaffingOverview();
      setStaffingMap(Object.fromEntries((res.data || []).map((d) => [d.id, d])));
    } catch (err) {
      console.error("Ошибка при получении штата:", err);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchPage(1, true);
    fetchCounts();
    fetchStaffing();
  }, [fetchPage, fetchCounts, fetchStaffing]);

  useEffect(() => {
    fetchPage(1);
    fetchCounts();
    fetchStaffing();
    return () => clearTimeout(searchTimerRef.current);
  }, []);

  useEffect(() => {
    if (hideBranch) return;
    getActiveBranches()
      .then((res) => res.success && setBranches(res.data || []))
      .catch((err) => console.error("Ошибка при получении филиалов:", err));
  }, [hideBranch]);

  usePullToRefresh(refreshAll, scrollRef, loading);

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

  const changeBranch = (value) => {
    if (value === branchRef.current) return;
    branchRef.current = value;
    setBranchId(value);
    scrollRef.current?.scrollTo({ top: 0 });
    fetchPage(1);
    fetchCounts();
  };

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

  const openForm = (id) =>
    pushScreen(
      id ? `edit-department-${id}` : "add-department",
      <DepartmentFormScreenTelegram id={id} onSaved={refreshAll} />,
    );

  const handleDelete = async () => {
    const id = deleteId;
    setDeleteId(null);
    if (!id) return;
    try {
      await deleteDepartmentById(id);
      showAlert(t("success"), "success");
      refreshAll();
    } catch (err) {
      console.error("Ошибка при удалении:", err);
      showAlert(err.response?.data?.error || t("error"), "error");
    }
  };

  const total = counts.all;
  const inactiveCount = total === null ? null : total - (counts.active ?? 0);
  const tiles = [
    { key: "all", label: t("all"), icon: <IconBuilding />, value: total, tone: styles.toneIndigo },
    { key: "active", label: t("enabled"), icon: <IconCheck />, value: counts.active, tone: styles.toneGreen },
    { key: "inactive", label: t("disabled"), icon: <IconClose />, value: inactiveCount, tone: styles.toneRed },
  ];

  const showBranches = !hideBranch && branches.length > 1;
  const branchChips = useMemo(
    () => [{ id: ALL_BRANCHES, name: t("all") }, ...branches],
    [branches, t],
  );

  return (
    <div className={styles.page}>
      <div className={styles.topGlass} />

      <div className={styles.main} id="scroll-container" ref={scrollRef}>
        <header className={styles.head}>
          <h1 className={styles.title}>{t("departments")}</h1>
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

        <div className={styles.searchBar}>
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

          {showBranches && (
            <div className={styles.branchRow} role="tablist">
              {branchChips.map((branch) => (
                <button
                  key={branch.id === ALL_BRANCHES ? "all" : branch.id}
                  type="button"
                  role="tab"
                  aria-selected={branchId === branch.id}
                  className={`${styles.branchChip} ${branchId === branch.id ? styles.branchChipActive : ""}`}
                  onClick={() => changeBranch(branch.id)}
                >
                  {branch.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.list}>
          {loading ? (
            Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)
          ) : data.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>
                <IconBuilding />
              </span>
              <p>{t("noData")}</p>
            </div>
          ) : (
            data.map((item, index) => (
              <DepartmentCard
                key={item.id}
                item={item}
                staffing={staffingMap[item.id]}
                hideBranch={hideBranch}
                canEdit={canEdit}
                canDelete={canDelete}
                onOpen={openForm}
                onDelete={setDeleteId}
                innerRef={index === data.length - 5 ? sentinelRef : null}
                t={t}
              />
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
          aria-label={t("addDepartment")}
        >
          <IconPlus />
        </button>
      )}

      <CenterModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onAccept={handleDelete}
        message={t("areYouSureDelete")}
      />
    </div>
  );
};

export default DepartmentsPageTelegram;
