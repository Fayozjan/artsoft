import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { getAttendance, getActiveDepartments } from "../api";
import { useScreenStack } from "../context/ScreenStackContext";

import Loading from "../components/Loading";
import AttendanceTableTelegram from "../components/AttendanceTableTelegram";

import { Icons } from "../icons/icons";
import { useAuthStore } from "../stores/authStore";

import { usePullToRefresh } from "../hooks/usePullToRefresh";

import styles from "./AttendancePageTelegram.module.scss";

export const isToday = (dateString) => {
  if (!dateString) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateString === today;
};

export const STATUS_FILTERS = [
  {
    key: "present",
    labelKey: "checkedIn",
    labelSingularKey: "checkedInSingular",
    color: "#16a34a",
    bg: "#f0fdf4",
    activeBg: "#16a34a",
    border: "#86efac",
  },
  {
    key: "absent",
    labelKey: "notCheckedIn",
    labelSingularKey: "notCheckedInSingular",
    color: "#dc2626",
    bg: "#fef2f2",
    activeBg: "#dc2626",
    border: "#fca5a5",
  },
  {
    key: "late",
    labelKey: "lateGroup",
    labelSingularKey: "lateSingular",
    color: "#d97706",
    bg: "#fffbeb",
    activeBg: "#d97706",
    border: "#fcd34d",
  },
  {
    key: "inside",
    labelKey: "onSite",
    labelSingularKey: "onSite",
    color: "#2563eb",
    bg: "#eff6ff",
    activeBg: "#2563eb",
    border: "#93c5fd",
  },
  {
    key: "left",
    labelKey: "checkedOut",
    labelSingularKey: "checkedOutSingular",
    color: "#7c3aed",
    bg: "#f5f3ff",
    activeBg: "#7c3aed",
    border: "#c4b5fd",
  },
];

const today = new Date().toISOString().slice(0, 10);

// ── Main page ──────────────────────────────────────────────────────────────────
const AttendancePageTelegram = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({});
  const [departments, setDepartments] = useState([]);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStatusFilters, setActiveStatusFilters] = useState(new Set());
  const scrollRef = useRef(null);

  const { t } = useTranslation();
  const { pushScreen, popScreen } = useScreenStack();
  const { viewMode, activeBranchId } =
    useAuthStore((s) => s.userSettings) || {};

  const initialFormData = { date: today, branch_id: "", department_id: "" };
  const [formData, setFormData] = useState(initialFormData);
  const formDataRef = useRef(initialFormData);

  const countActiveFilters = (fd) =>
    ["date", "branch_id", "department_id"].filter((k) => fd[k]).length;

  // ── Data fetching ─────────────────────────────────────────────────────────────
  const fetchData = async (filters = formDataRef.current) => {
    setLoading(true);
    try {
      const { data: rows } = await getAttendance({ filters });
      setData(rows);
    } catch (error) {
      console.error("Ошибка при получении данных:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchDeps = async () => {
    try {
      const res = await getActiveDepartments();
      if (res?.success) setDepartments(res.data);
    } catch (err) {
      console.error("Ошибка загрузки отделов:", err.message);
    }
  };

  // ── Counts per status (from data) ─────────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counts = {};
    STATUS_FILTERS.forEach(({ key }) => {
      counts[key] = Array.isArray(data[key]) ? data[key].length : 0;
    });
    return counts;
  }, [data]);

  useEffect(() => {
    fetchData();
    fetchDeps();
  }, []);

  useEffect(() => {
    if (viewMode === "branch") fetchData(formDataRef.current);
  }, [activeBranchId]);

  // ── Open filter screen ────────────────────────────────────────────────────────
  const openFilter = () => {
    pushScreen(
      "filter",
      <FilterScreen
        departments={departments}
        formData={formData}
        initialFormData={initialFormData}
        onApply={(newFilters) => {
          setFormData(newFilters);
          formDataRef.current = newFilters;
          setActiveFiltersCount(countActiveFilters(newFilters));
          fetchData(newFilters);
          popScreen();
        }}
        t={t}
      />,
    );
  };

  const toggleStatusFilter = (key) => {
    setActiveStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  usePullToRefresh(() => fetchData(), scrollRef, loading);

  return (
    <div className={styles.attendancePage}>
      <div className={styles.header} />

      <div className={styles.main} id="scroll-container" ref={scrollRef}>
        <div className={styles.searchFilterRow}>
          <div className={styles.searchBox}>
            <span className={styles.searchIcon}>{Icons.search}</span>
            <input
              type="text"
              placeholder={t("search") || "Поиск..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery.length > 0 && (
              <button
                className={styles.clearBtn}
                onClick={() => setSearchQuery("")}
              >
                {Icons.clear}
              </button>
            )}
          </div>

          <button
            className={`${styles.filterBtn} ${activeFiltersCount > 0 ? styles.filterBtnActive : ""}`}
            onClick={openFilter}
          >
            {Icons.filter}
            {activeFiltersCount > 0 && <span className={styles.filterBadge} />}
          </button>
        </div>

        <div className={styles.chipsRow}>
          {STATUS_FILTERS.map((f) => {
            const isActive = activeStatusFilters.has(f.key);
            const count = statusCounts[f.key];
            return (
              <button
                key={f.key}
                className={`${styles.chip} ${isActive ? styles.chipActive : ""}`}
                style={{
                  "--chip-color": f.color,
                  "--chip-bg": f.bg,
                  "--chip-active-bg": f.activeBg,
                  "--chip-border": f.border,
                }}
                onClick={() => toggleStatusFilter(f.key)}
              >
                {t(f.labelKey)}
                {count > 0 && <span className={styles.chipCount}>{count}</span>}
              </button>
            );
          })}
        </div>

        {((formData.date && formData.date !== today) ||
          activeFiltersCount > 0 ||
          activeStatusFilters.size > 0) && (
          <div className={styles.activeFiltersBar}>
            {formData.date && formData.date !== today && (
              <span className={styles.activeFilterTag}>
                {formData.date}
                <button
                  onClick={() => {
                    const next = { ...formData, date: today };
                    setFormData(next);
                    formDataRef.current = next;
                    setActiveFiltersCount(countActiveFilters(next));
                    fetchData(next);
                  }}
                >
                  {Icons.clear}
                </button>
              </span>
            )}
            {formData.department_id && (
              <span className={styles.activeFilterTag}>
                {departments.find(
                  (dep) => String(dep.id) === String(formData.department_id),
                )?.name || t("department")}
                <button
                  onClick={() => {
                    const next = { ...formData, department_id: "" };
                    setFormData(next);
                    formDataRef.current = next;
                    setActiveFiltersCount(countActiveFilters(next));
                    fetchData(next);
                  }}
                >
                  {Icons.clear}
                </button>
              </span>
            )}
            {[...activeStatusFilters].map((key) => {
              const f = STATUS_FILTERS.find((f) => f.key === key);
              return (
                <span
                  key={key}
                  className={styles.activeFilterTag}
                  style={{
                    "--tag-color": f.color,
                    "--tag-bg": f.bg,
                    "--tag-border": f.border,
                  }}
                >
                  <span
                    className={styles.activeFilterDot}
                    style={{ background: f.color }}
                  />
                  {t(f.labelKey)}
                  <button onClick={() => toggleStatusFilter(key)}>
                    {Icons.clear}
                  </button>
                </span>
              );
            })}
          </div>
        )}

        <AttendanceTableTelegram
          rowData={data}
          viewMode={viewMode}
          search={searchQuery}
          activeStatusFilters={activeStatusFilters}
        />
      </div>

      {loading && <Loading />}
    </div>
  );
};

// ── Filter screen ──────────────────────────────────────────────────────────────
const FilterScreen = ({
  departments,
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
    setLocalForm((prev) => ({ ...prev, [name]: value || "" }));
  };

  return (
    <div className={styles.filterPage}>
      <div className={styles.filterHeader}>
        <span className={styles.filterTitle}>{t("filters") || "Фильтры"}</span>
      </div>

      <div className={styles.filterBody}>
        <div className={styles.filterSection}>
          <label className={styles.fieldLabel}>{t("date") || "Дата"}</label>
          <input
            className={styles.dateInput}
            type="date"
            name="date"
            value={localForm.date}
            onChange={handleChange}
            onFocus={(e) => e.target.showPicker?.()}
          />
        </div>

        <div className={styles.filterSection}>
          <label className={styles.fieldLabel}>
            {t("department") || t("department")}
          </label>
          <select
            className={styles.select}
            name="department_id"
            value={localForm.department_id || ""}
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

export default AttendancePageTelegram;
