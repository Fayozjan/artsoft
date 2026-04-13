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

import Loading from "../components/Loading";
import { useOpenEditEmployee } from "../hooks/useOpenEditEmployee";

import { useScreenStack } from "../context/ScreenStackContext";

import { Icons } from "../icons/icons";
import { useAuthStore } from "../stores/authStore";

import styles from "./EmployeesPageTelegram.module.scss";

const PAGE_SIZE = 50;

import VConsole from "vconsole";

const vConsole = new VConsole();

const EmployeePageTelegram = ({ routePath }) => {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [data, setData] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  const { pushScreen, popScreen } = useScreenStack();
  const { showAlert } = useAlertStore();
  const { t } = useTranslation();
  const { canEdit } = usePermissionsTelegram(routePath);
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

  const countActiveFilters = (fd) => {
    let count = 0;
    if (fd.department_id) count++;
    if (fd.position_id) count++;
    if (fd.status !== "") count++;
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
          setFormData(newFilters);
          formDataRef.current = newFilters;
          setActiveFiltersCount(countActiveFilters(newFilters));
          fetchEmployees(1, newFilters);
          popScreen();
        }}
        onClose={popScreen}
        t={t}
      />,
    );
  };

  const openEdit = useOpenEditEmployee(() => fetchEmployees(1));

  usePullToRefresh(() => fetchEmployees(1), scrollRef, loading);

  return (
    <div className={styles.page}>
      <div className={styles.header} />
      <div className={styles.main} id="scroll-container" ref={scrollRef}>
        <div className={styles.searchFilterRow}>
          <div className={styles.searchBox}>
            <span className={styles.searchIcon}>{Icons.search}</span>
            <input
              type="text"
              placeholder={t("search") || "Поиск..."}
              value={searchQuery}
              onChange={handleSearchChange}
            />
            {searchQuery.length > 0 && (
              <button className={styles.clearBtn} onClick={handleSearchClear}>
                {Icons.clear}
              </button>
            )}
          </div>

          <button
            className={`${styles.filterBtn} ${activeFiltersCount > 0 ? styles.filterBtnActive : ""}`}
            onClick={openFilter}
          >
            {Icons.filter ?? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
              </svg>
            )}
            {activeFiltersCount > 0 && <span className={styles.filterBadge} />}
          </button>
        </div>

        {activeFiltersCount > 0 && (
          <div className={styles.activeFiltersBar}>
            {formData.department_id && (
              <span className={styles.activeFilterTag}>
                {departments.find(
                  (d) => String(d.id) === String(formData.department_id),
                )?.name || t("department")}
                <button
                  onClick={() => {
                    const next = { ...formData, department_id: null };
                    setFormData(next);
                    formDataRef.current = next;
                    setActiveFiltersCount(countActiveFilters(next));
                    fetchEmployees(1, next);
                  }}
                >
                  {Icons.clear}
                </button>
              </span>
            )}
            {formData.position_id && (
              <span className={styles.activeFilterTag}>
                {positions.find(
                  (p) => String(p.id) === String(formData.position_id),
                )?.name || t("position")}
                <button
                  onClick={() => {
                    const next = { ...formData, position_id: null };
                    setFormData(next);
                    formDataRef.current = next;
                    setActiveFiltersCount(countActiveFilters(next));
                    fetchEmployees(1, next);
                  }}
                >
                  {Icons.clear}
                </button>
              </span>
            )}
            {formData.status !== "" && (
              <span className={styles.activeFilterTag}>
                {formData.status === "true" ? t("active") : t("terminated")}
                <button
                  onClick={() => {
                    const next = { ...formData, status: "" };
                    setFormData(next);
                    formDataRef.current = next;
                    setActiveFiltersCount(countActiveFilters(next));
                    fetchEmployees(1, next);
                  }}
                >
                  {Icons.clear}
                </button>
              </span>
            )}
          </div>
        )}

        <div className={styles.cardList} ref={listRef}>
          {!loading && data.length === 0 && (
            <p className={styles.empty}>{t("noData")}</p>
          )}
          {data.map((emp, idx) => (
            <EmployeeCard
              key={emp.user_id || idx}
              innerRef={idx === data.length - 5 ? sentinelRef : null}
              employee={emp}
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
        <div className={styles.filterSection}>
          <label className={styles.fieldLabel}>{t("status") || "Статус"}</label>
          <div className={styles.directionGroup}>
            {[
              { value: "", label: t("all") || "Все" },
              { value: "true", label: t("active") || "Работает" },
              { value: "false", label: t("terminated") || "Уволен" },
            ].map(({ value, label }) => (
              <label key={value} className={styles.dirLabel}>
                <input
                  type="checkbox"
                  checked={localForm.status === value}
                  onChange={() =>
                    setLocalForm((prev) => ({ ...prev, status: value }))
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>
      <button
        className={styles.resetBtn}
        onClick={() => setLocalForm(initialFormData)}
      >
        {t("clearAll") || "Сбросить"}
      </button>
      <div className={styles.filterFooter}>
        <button className={styles.applyBtn} onClick={() => onApply(localForm)}>
          {t("apply") || "Применить"}
        </button>
      </div>
    </div>
  );
};

// ── Employee Card ──────────────────────────────────────────────────────────────
const EmployeeCard = ({ employee, canEdit, onTap, t, innerRef }) => {
  const fullName =
    [employee.last_name, employee.first_name].filter(Boolean).join(" ") ||
    t("unknown");

  return (
    <div
      className={`${styles.card} ${canEdit ? styles.cardTappable : ""}`}
      ref={innerRef}
      onClick={() => canEdit && onTap()}
    >
      <div
        className={`${styles.cardAvatar} ${employee.status ? styles.cardAvatarActive : styles.cardAvatarInactive}`}
      >
        {employee.photo ? (
          <img
            key={employee.id}
            src={`/api/employees/image/${employee.photo}?t=${new Date(employee.updated_at).getTime()}`}
            alt={fullName}
            loading="lazy"
          />
        ) : (
          <span className={styles.avatarFallback}>
            {fullName.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <div className={styles.cardBody}>
        <p className={styles.cardName}>
          {fullName} {employee.id}
        </p>
        <p className={styles.cardSub}>{employee.position?.name || "—"}</p>
        <p className={styles.cardMeta}>{employee.department?.name || ""}</p>
      </div>
    </div>
  );
};

export default EmployeePageTelegram;
