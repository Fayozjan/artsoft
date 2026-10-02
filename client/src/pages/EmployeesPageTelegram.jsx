import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { useAlertStore } from "../stores/alertStore";
import { usePermissionsTelegram } from "../hooks/usePermissionsTelegram";
import {
  EmployeeService,
  getActiveDepartments,
  getActivePositions,
} from "../api";

import Loading from "../components/LoadingTelegram";
import { useOpenEditEmployee } from "../hooks/useOpenEditEmployee";
import { useOpenAddEmployee } from "../hooks/useOpenAddEmployee";
import {
  IconSearch,
  IconClose,
  IconFilter,
  IconChevronRight,
  IconUsers,
  IconPlus,
} from "../components/tg/tgIcons";

import { useScreenStack } from "../context/ScreenStackContext";
import { useAuthStore } from "../stores/authStore";

import styles from "./EmployeesPageTelegram.module.scss";

const PAGE_SIZE = 50;

const AVATAR_GRADIENTS = [
  ["#6366f1", "#8b5cf6"],
  ["#0ea5e9", "#2563eb"],
  ["#10b981", "#059669"],
  ["#f59e0b", "#ef4444"],
  ["#ec4899", "#db2777"],
  ["#14b8a6", "#0ea5e9"],
];

const getAvatarGradient = (seed) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash += seed.charCodeAt(i);
  const [from, to] = AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
};

const EmployeePageTelegram = ({ routePath }) => {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  const { pushScreen, popScreen } = useScreenStack();
  const { showAlert } = useAlertStore();
  const { t } = useTranslation();
  const { canAdd, canEdit } = usePermissionsTelegram(routePath);
  const { activeBranchId } = useAuthStore((s) => s.userSettings) || {};
  const scrollRef = useRef(null);
  const listRef = useRef(null);
  const observerRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);
  const currentPageRef = useRef(1);
  const searchQueryRef = useRef("");
  const searchTimerRef = useRef(null);

  const initialFormData = {
    department_id: null,
    position_id: null,
    status: "",
  };
  const [formData, setFormData] = useState(initialFormData);
  const formDataRef = useRef(initialFormData);

  // Статус переключается быстрыми чипами, в счётчик фильтров он не входит.
  const countActiveFilters = (fd) => {
    let count = 0;
    if (fd.department_id) count++;
    if (fd.position_id) count++;
    return count;
  };

  const fetchEmployees = async (page = 1, filters = formDataRef.current) => {
    if (loadingMoreRef.current || (page > 1 && !hasMoreRef.current)) return;
    if (page === 1) {
      setLoading(true);
      hasMoreRef.current = true;
    } else {
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }

    try {
      const params = {
        search: searchQueryRef.current,
        page,
        pageSize: PAGE_SIZE,
        department_id: filters.department_id || undefined,
        position_id: filters.position_id || undefined,
        status: filters.status !== "" ? filters.status : undefined,
      };
      const { data: employees, pagination } =
        await EmployeeService.getAll(params);
      const list = employees || [];
      setData((prev) => (page === 1 ? list : [...prev, ...list]));
      if (page === 1) setTotal(pagination?.totalItems ?? list.length);
      currentPageRef.current = page;
      hasMoreRef.current = page < (pagination?.totalPages || 1);
    } catch (err) {
      console.error("Fetch error:", err);
      showAlert(t("errorLoading"), "error");
    } finally {
      setLoading(false);
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  };

  const fetchMeta = async () => {
    try {
      const [deptRes, posRes] = await Promise.all([
        getActiveDepartments(),
        getActivePositions(),
      ]);
      if (deptRes?.success) setDepartments(deptRes.data);
      if (posRes?.success) setPositions(posRes.data);
    } catch (err) {
      console.error("Ошибка загрузки мета:", err.message);
    }
  };

  const applyFilters = (next) => {
    setFormData(next);
    formDataRef.current = next;
    setActiveFiltersCount(countActiveFilters(next));
    fetchEmployees(1, next);
  };

  useEffect(() => {
    fetchMeta();
  }, []);

  useEffect(() => {
    fetchEmployees(1);
  }, [activeBranchId]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      searchQueryRef.current = value;
      fetchEmployees(1);
    }, 350);
  };

  const handleSearchClear = () => {
    setSearchQuery("");
    searchQueryRef.current = "";
    fetchEmployees(1);
  };

  const sentinelRef = useCallback(
    (node) => {
      if (loading) return;
      if (observerRef.current) observerRef.current.disconnect();
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (
            entries[0].isIntersecting &&
            hasMoreRef.current &&
            !loadingMoreRef.current
          ) {
            fetchEmployees(currentPageRef.current + 1);
          }
        },
        { root: scrollRef.current, rootMargin: "400px" },
      );
      if (node) observerRef.current.observe(node);
    },
    [loading],
  );

  const openFilter = () => {
    pushScreen(
      "filter",
      <FilterScreen
        departments={departments}
        positions={positions}
        formData={formData}
        initialFormData={initialFormData}
        onApply={(newFilters) => {
          applyFilters(newFilters);
          popScreen();
        }}
        onClose={popScreen}
        t={t}
      />,
    );
  };

  const openEdit = useOpenEditEmployee(() => fetchEmployees(1));
  const openAdd = useOpenAddEmployee(() => fetchEmployees(1));

  usePullToRefresh(() => fetchEmployees(1), scrollRef, loading);

  const statusOptions = [
    { value: "", label: t("all") || "Все" },
    { value: "true", label: t("active") || "Работает" },
    { value: "false", label: t("terminated") || "Уволен" },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header} />
      <div className={styles.main} id="scroll-container" ref={scrollRef}>
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>{t("employees")}</h1>
          {total > 0 && <span className={styles.heroCount}>{total}</span>}
        </div>

        <div className={styles.toolbar}>
          <div className={styles.searchFilterRow}>
            <div className={styles.searchBox}>
              <span className={styles.searchIcon}>
                <IconSearch />
              </span>
              <input
                type="text"
                placeholder={t("search") || "Поиск..."}
                value={searchQuery}
                onChange={handleSearchChange}
              />
              {searchQuery.length > 0 && (
                <button className={styles.clearBtn} onClick={handleSearchClear}>
                  <IconClose />
                </button>
              )}
            </div>

            <button
              className={`${styles.filterBtn} ${activeFiltersCount > 0 ? styles.filterBtnActive : ""}`}
              onClick={openFilter}
            >
              <IconFilter />
              {activeFiltersCount > 0 && (
                <span className={styles.filterBadge}>{activeFiltersCount}</span>
              )}
            </button>
          </div>

          <div className={styles.segment}>
            {statusOptions.map(({ value, label }) => (
              <button
                key={value}
                className={`${styles.segmentBtn} ${formData.status === value ? styles.segmentBtnActive : ""}`}
                onClick={() => {
                  if (formData.status !== value) {
                    applyFilters({ ...formData, status: value });
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {activeFiltersCount > 0 && (
            <div className={styles.activeFiltersBar}>
              {formData.department_id && (
                <span className={styles.activeFilterTag}>
                  {departments.find(
                    (d) => String(d.id) === String(formData.department_id),
                  )?.name || t("department")}
                  <button
                    onClick={() =>
                      applyFilters({ ...formData, department_id: null })
                    }
                  >
                    <IconClose />
                  </button>
                </span>
              )}
              {formData.position_id && (
                <span className={styles.activeFilterTag}>
                  {positions.find(
                    (p) => String(p.id) === String(formData.position_id),
                  )?.name || t("position")}
                  <button
                    onClick={() =>
                      applyFilters({ ...formData, position_id: null })
                    }
                  >
                    <IconClose />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        <div className={styles.cardList} ref={listRef}>
          {!loading && data.length === 0 && (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>
                <IconUsers />
              </span>
              <p>{t("noData")}</p>
            </div>
          )}
          {data.map((emp, idx) => (
            <EmployeeCard
              key={emp.user_id || idx}
              innerRef={idx === data.length - 5 ? sentinelRef : null}
              employee={emp}
              index={idx}
              canEdit={canEdit}
              onTap={() => openEdit(emp.id)}
              t={t}
            />
          ))}
          {loadingMore && (
            <div className={styles.bottomLoader}>
              <span className={styles.bottomLoaderDot} />
              <span className={styles.bottomLoaderDot} />
              <span className={styles.bottomLoaderDot} />
            </div>
          )}
        </div>
      </div>

      {canAdd && (
        <button
          type="button"
          className={styles.fab}
          onClick={openAdd}
          aria-label={t("addEmployee")}
        >
          <IconPlus />
        </button>
      )}

      {loading && <Loading />}
    </div>
  );
};

// ── Filter screen ──────────────────────────────────────────────────────────────
const FilterScreen = ({
  departments,
  positions,
  formData,
  initialFormData,
  onApply,
  t,
}) => {
  const [localForm, setLocalForm] = useState(formData);

  useEffect(() => {
    setLocalForm(formData);
  }, [formData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLocalForm((prev) => ({ ...prev, [name]: value || null }));
  };

  return (
    <div className={styles.filterPage}>
      <div className={styles.filterHeader}>
        <span className={styles.filterTitle}>{t("filters") || "Фильтры"}</span>
      </div>
      <div className={styles.filterBody}>
        <div className={styles.filterSection}>
          <label className={styles.fieldLabel}>
            {t("department") || "Отдел"}
          </label>
          <select
            className={styles.select}
            name="department_id"
            value={
              localForm.department_id ? String(localForm.department_id) : ""
            }
            onChange={handleChange}
          >
            <option value="">{t("all") || "Все"}</option>
            {departments.map((dep) => (
              <option key={dep.id} value={String(dep.id)}>
                {dep.name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.filterSection}>
          <label className={styles.fieldLabel}>
            {t("position") || "Должность"}
          </label>
          <select
            className={styles.select}
            name="position_id"
            value={localForm.position_id ? String(localForm.position_id) : ""}
            onChange={handleChange}
          >
            <option value="">{t("all") || "Все"}</option>
            {positions.map((pos) => (
              <option key={pos.id} value={String(pos.id)}>
                {pos.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className={styles.filterFooter}>
        <button
          className={styles.resetBtn}
          onClick={() =>
            setLocalForm((prev) => ({
              ...initialFormData,
              status: prev.status,
            }))
          }
        >
          {t("clearAll") || "Сбросить"}
        </button>
        <button className={styles.applyBtn} onClick={() => onApply(localForm)}>
          {t("apply") || "Применить"}
        </button>
      </div>
    </div>
  );
};

// ── Employee Card ──────────────────────────────────────────────────────────────
const EmployeeCard = ({ employee, index, canEdit, onTap, t, innerRef }) => {
  const fullName =
    [employee.last_name, employee.first_name].filter(Boolean).join(" ") ||
    t("unknown");
  const initials =
    [employee.last_name, employee.first_name]
      .filter(Boolean)
      .map((part) => part.charAt(0))
      .join("")
      .toUpperCase() || fullName.charAt(0).toUpperCase();
  const isActive = Boolean(employee.status);

  return (
    <div
      className={`${styles.card} ${canEdit ? styles.cardTappable : ""} ${isActive ? "" : styles.cardInactive}`}
      style={{ "--i": index % 8 }}
      ref={innerRef}
      onClick={() => canEdit && onTap()}
    >
      <div className={styles.cardAvatarWrap}>
        <div
          className={styles.cardAvatar}
          style={
            employee.photo
              ? undefined
              : { background: getAvatarGradient(fullName) }
          }
        >
          {employee.photo ? (
            <img
              key={employee.id}
              src={`/api/employees/image/${employee.photo}?t=${new Date(employee.updated_at).getTime()}`}
              alt={fullName}
              loading="lazy"
            />
          ) : (
            <span className={styles.avatarFallback}>{initials}</span>
          )}
        </div>
        <span
          className={`${styles.statusDot} ${isActive ? styles.statusDotActive : styles.statusDotInactive}`}
        />
      </div>

      <div className={styles.cardBody}>
        <p className={styles.cardName}>{fullName}</p>
        <p className={styles.cardSub}>{employee.position?.name || "—"}</p>
        {(employee.department?.name || !isActive) && (
          <div className={styles.cardChips}>
            {employee.department?.name && (
              <span className={styles.chip}>{employee.department.name}</span>
            )}
            {!isActive && (
              <span className={`${styles.chip} ${styles.chipRed}`}>
                {t("terminated")}
              </span>
            )}
          </div>
        )}
      </div>

      <div className={styles.cardAside}>
        <span className={styles.cardId}>#{employee.id}</span>
        {canEdit && (
          <span className={styles.cardChevron}>
            <IconChevronRight />
          </span>
        )}
      </div>
    </div>
  );
};

export default EmployeePageTelegram;
