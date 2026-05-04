import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";

import { getVehiclePasses } from "../api/vehiclePasses";
import { getActiveGates } from "../api";
import { useAlertStore } from "../stores/alertStore";
import { useScreenStack } from "../context/ScreenStackContext";

import Loading from "../components/Loading";
import { Icons } from "../icons/icons";

import styles from "./VehiclePassesPageTelegram.module.scss";
import { usePullToRefresh } from "../hooks/usePullToRefresh";

const PAGE_SIZE = 50;

const parsePlate = (raw = "") => {
  const clean = raw.replace(/[^A-Z0-9]/gi, "").toUpperCase();

  let match = clean.match(/^(\d{2})([A-Z])(\d{3})([A-Z]{2})$/);
  if (match) {
    const region = match[1],
      series = match[2],
      number = match[3],
      suffix = match[4];
    return {
      region,
      series,
      number,
      suffix,
      formatted: `${region} ${series} ${number} ${suffix}`,
    };
  }

  match = clean.match(/^(\d{2})(\d{3})([A-Z]{3})$/);
  if (match) {
    const region = match[1],
      number = match[2],
      suffix = match[3];
    return {
      region,
      series: null,
      number,
      suffix,
      formatted: `${region} ${number} ${suffix}`,
    };
  }

  match = clean.match(/^(\d{3,4})([A-Z]{2})(\d{2})$/);
  if (match) {
    const region = match[3],
      number = match[1],
      suffix = match[2];
    return {
      region,
      series: null,
      number,
      suffix,
      formatted: `${region} ${number} ${suffix}`,
    };
  }

  return {
    region: null,
    series: null,
    number: raw || "—",
    suffix: null,
    formatted: raw || "—",
  };
};

// ── Main page ──────────────────────────────────────────────────────────────────
const VehiclePassesPageTelegram = () => {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [data, setData] = useState([]);
  const [gates, setGates] = useState([]);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);

  const { showAlert } = useAlertStore();
  const { t } = useTranslation();
  const { pushScreen, popScreen } = useScreenStack();

  const scrollRef = useRef(null);
  const listRef = useRef(null);
  const observerRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);
  const currentPageRef = useRef(1);

  const [searchQuery, setSearchQuery] = useState("");
  const searchQueryRef = useRef("");

  const today = new Date().toISOString().slice(0, 10);

  const initialFormData = {
    start_date: `${today} 00:00`,
    end_date: `${today} 23:59`,
    branch_id: null,
    direction: "",
    selectedGateIds: [],
  };

  const [formData, setFormData] = useState(initialFormData);
  const formDataRef = useRef(initialFormData);

  // ── Active filters count ─────────────────────────────────────────────────────
  const countActiveFilters = (fd) => {
    let count = 0;
    if (fd.start_date) count++;
    if (fd.branch_id) count++;
    if (fd.direction) count++;
    if (fd.selectedGateIds?.length) count++;
    return count;
  };

  // ── Data fetching ────────────────────────────────────────────────────────────
  const fetchEvents = async (page = 1, filters = formDataRef.current) => {
    if (loadingMoreRef.current || (page > 1 && !hasMoreRef.current)) return;

    if (page === 1) {
      setLoading(true);
      hasMoreRef.current = true;
    } else {
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }

    try {
      const { data: events, pagination } = await getVehiclePasses({
        page,
        pageSize: PAGE_SIZE,
        filters: { ...filters, search: searchQueryRef.current },
      });

      const list = events || [];
      const totalPages = pagination?.totalPages || 1;

      setData((prev) => (page === 1 ? list : [...prev, ...list]));
      currentPageRef.current = page;
      hasMoreRef.current = page < totalPages;
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
      const gatesRes = await getActiveGates();
      if (gatesRes?.success) setGates(gatesRes.data);
    } catch (err) {
      console.error("Ошибка загрузки ворот:", err.message);
    }
  };

  useEffect(() => {
    fetchMeta();
  }, []);
  useEffect(() => {
    fetchEvents(1);
  }, []);

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
            fetchEvents(currentPageRef.current + 1);
          }
        },
        { root: listRef.current, rootMargin: "400px" },
      );

      if (node) observerRef.current.observe(node);
    },
    [loading],
  );

  // ── Search: debounced ────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      searchQueryRef.current = searchQuery;
      fetchEvents(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Open filter screen ───────────────────────────────────────────────────────
  const openFilter = () => {
    pushScreen(
      "filter",
      <FilterScreen
        gates={gates}
        formData={formData}
        initialFormData={initialFormData}
        onApply={(newFilters) => {
          setFormData(newFilters);
          formDataRef.current = newFilters;
          setActiveFiltersCount(countActiveFilters(newFilters));
          fetchEvents(1, newFilters);
          popScreen();
        }}
        onClose={popScreen}
        t={t}
      />,
    );
  };

  usePullToRefresh(() => fetchEvents(), scrollRef, loading);

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

        {/* Active filter tags */}
        {activeFiltersCount > 0 && (
          <div className={styles.activeFiltersBar}>
            {(formData.start_date !== initialFormData.start_date ||
              formData.end_date !== initialFormData.end_date) && (
              <span className={styles.activeFilterTag}>
                {formData.start_date &&
                  `${t("filterFrom")}: ${new Date(
                    formData.start_date,
                  ).toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`}
                {formData.end_date &&
                  ` ${t("filterTo")}: ${new Date(
                    formData.end_date,
                  ).toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`}
                <button
                  onClick={() => {
                    const next = {
                      ...formData,
                      start_date: initialFormData.start_date,
                      end_date: initialFormData.end_date,
                    };
                    setFormData(next);
                    formDataRef.current = next;
                    setActiveFiltersCount(countActiveFilters(next));
                    fetchEvents(1, next);
                  }}
                >
                  {Icons.clear}
                </button>
              </span>
            )}

            {formData.direction && (
              <span className={styles.activeFilterTag}>
                {formData.direction === "entry" ? t("forward") : t("reverse")}
                <button
                  onClick={() => {
                    const next = { ...formData, direction: "" };
                    setFormData(next);
                    formDataRef.current = next;
                    setActiveFiltersCount(countActiveFilters(next));
                    fetchEvents(1, next);
                  }}
                >
                  {Icons.clear}
                </button>
              </span>
            )}

            {formData.selectedGateIds?.length > 0 && (
              <span className={styles.activeFilterTag}>
                {gates
                  .filter((g) =>
                    formData.selectedGateIds.includes(String(g.id)),
                  )
                  .map((g) => g.name)
                  .join(", ") || t("gates")}
                <button
                  onClick={() => {
                    const next = { ...formData, selectedGateIds: [] };
                    setFormData(next);
                    formDataRef.current = next;
                    setActiveFiltersCount(countActiveFilters(next));
                    fetchEvents(1, next);
                  }}
                >
                  {Icons.clear}
                </button>
              </span>
            )}
          </div>
        )}

        {/* Card list */}
        {loading ? (
          <div className={styles.centerLoading}>
            <Loading />
          </div>
        ) : (
          <div className={styles.cardList} ref={listRef}>
            {data.length === 0 && <p className={styles.empty}>{t("noData")}</p>}
            {data.map((event, idx) => (
              <VehicleCard
                key={event.id || idx}
                innerRef={idx === data.length - 5 ? sentinelRef : null}
                event={event}
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
        )}
      </div>
    </div>
  );
};

// ── Filter screen ──────────────────────────────────────────────────────────────
const FilterScreen = ({ gates, formData, initialFormData, onApply, t }) => {
  const [localForm, setLocalForm] = useState(formData);

  useEffect(() => {
    setLocalForm(formData);
  }, [formData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLocalForm((prev) => ({ ...prev, [name]: value || null }));
  };

  const handleReset = () => setLocalForm(initialFormData);

  return (
    <div className={styles.filterPage}>
      <div className={styles.filterHeader}>
        <span className={styles.filterTitle}>{t("filters") || "Фильтры"}</span>
      </div>

      <div className={styles.filterBody}>
        <div className={styles.filterRow}>
          <div className={styles.filterField}>
            <label className={styles.fieldLabel}>{t("filterFrom")}</label>
            <input
              className={styles.dateInput}
              type="datetime-local"
              name="start_date"
              value={localForm.start_date}
              onChange={handleChange}
              onFocus={(e) => e.target.showPicker?.()}
            />
          </div>
          <div className={styles.filterField}>
            <label className={styles.fieldLabel}>{t("filterTo")}</label>
            <input
              className={styles.dateInput}
              type="datetime-local"
              name="end_date"
              value={localForm.end_date}
              onChange={handleChange}
              onFocus={(e) => e.target.showPicker?.()}
            />
          </div>
        </div>

        <div className={styles.filterSection}>
          <label className={styles.fieldLabel}>{t("gatesBarrier")}</label>
          <select
            className={styles.select}
            multiple
            value={localForm.selectedGateIds || []}
            onChange={(e) => {
              const values = Array.from(
                e.target.selectedOptions,
                (opt) => opt.value,
              );
              setLocalForm((prev) => ({ ...prev, selectedGateIds: values }));
            }}
          >
            {gates.map((gate) => (
              <option key={gate.id} value={gate.id}>
                {gate.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterSection}>
          <label className={styles.fieldLabel}>{t("direction")}</label>
          <div className={styles.directionGroup}>
            {[
              { value: "", label: t("all") },
              { value: "entry", label: t("forward") },
              { value: "exit", label: t("reverse") },
            ].map(({ value, label }) => (
              <label key={value} className={styles.dirLabel}>
                <input
                  type="checkbox"
                  checked={localForm.direction === value}
                  onChange={() =>
                    setLocalForm((prev) => ({ ...prev, direction: value }))
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <button className={styles.resetBtn} onClick={handleReset}>
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

// ── Vehicle Card ───────────────────────────────────────────────────────────────
const VehicleCard = ({ event, t, innerRef }) => {
  const plateFormatted = parsePlate(event?.plate_number);
  const branchName = event.branch_name || "";
  const gateName = event.gate_name || "";
  const formattedTime = event.date;

  let directionText = t("unknown");
  if (event.direction === "entry") directionText = t("forward");
  if (event.direction === "exit") directionText = t("reverse");

  return (
    <div className={styles.card} ref={innerRef}>
      <div className={styles.cardAvatar}>
        {event.photo ? (
          <img
            src={`/api/vehicle-passes/image/${event.photo}`}
            alt={plateFormatted.formatted}
            loading="lazy"
          />
        ) : (
          <span className={styles.avatarFallback}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              width="28"
              height="28"
            >
              <path d="M5 11l1.5-4.5h11L19 11" strokeLinecap="round" />
              <rect x="3" y="11" width="18" height="7" rx="2" />
              <circle cx="7.5" cy="18" r="1.5" />
              <circle cx="16.5" cy="18" r="1.5" />
            </svg>
          </span>
        )}
      </div>

      <div className={styles.cardBody}>
        <p className={styles.cardName}>{plateFormatted.formatted}</p>
        {branchName && <p className={styles.cardSub}>{branchName}</p>}
        {gateName && <p className={styles.cardMeta}>{gateName}</p>}
      </div>

      <div className={styles.cardRight}>
        <span
          className={`${styles.dirBadge} ${
            event.direction === "entry"
              ? styles.dirIn
              : event.direction === "exit"
                ? styles.dirOut
                : styles.dirDefault
          }`}
        >
          {directionText}
        </span>
        <span className={styles.cardTime}>{formattedTime}</span>
      </div>
    </div>
  );
};

export default VehiclePassesPageTelegram;
