import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";

import {
  FacePassesService,
  getActiveDoors,
  getActivePositions,
  getActiveDepartments,
} from "../api";
import { useAlertStore } from "../stores/alertStore";
import { useScreenStack } from "../context/ScreenStackContext";

import Loading from "../components/Loading";
import { Icons } from "../icons/icons";

import styles from "./FacePassesPageTelegram.module.scss";
import { usePullToRefresh } from "../hooks/usePullToRefresh";

const PAGE_SIZE = 50;

// ── Main page ──────────────────────────────────────────────────────────────────
const FacePassesPageTelegram = () => {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [data, setData] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [doors, setDoors] = useState([]);
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
    department_id: null,
    position_id: null,
    direction: "",
    selectedDoorIds: [],
  };

  const [formData, setFormData] = useState(initialFormData);
  const formDataRef = useRef(initialFormData);

  // ── Active filters count ─────────────────────────────────────────────────────
  const countActiveFilters = (fd) => {
    let count = 0;
    if (fd.start_date) count++;
    if (fd.branch_id) count++;
    if (fd.department_id) count++;
    if (fd.position_id) count++;
    if (fd.direction) count++;
    if (fd.selectedDoorIds?.length) count++;
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
      const { data: events, pagination } =
        await FacePassesService.getFacePasses({
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

  const fetchData = async () => {
    try {
      const departmentsRes = await getActiveDepartments();
      if (departmentsRes?.success) setDepartments(departmentsRes.data);

      const positionsRes = await getActivePositions();
      if (positionsRes?.success) setPositions(positionsRes.data);

      const doorsRes = await getActiveDoors();
      if (doorsRes?.success) setDoors(doorsRes.data);
    } catch (err) {
      console.error("Ошибка загрузки:", err.message);
    }
  };

  useEffect(() => {
    fetchData();
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
        departments={departments}
        positions={positions}
        doors={doors}
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
                  `От: ${new Date(formData.start_date).toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`}
                {formData.end_date &&
                  ` До: ${new Date(formData.end_date).toLocaleString("ru-RU", {
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

            {formData.department_id && (
              <span className={styles.activeFilterTag}>
                {departments.find(
                  (dep) => String(dep.id) === String(formData.department_id),
                )?.name || "Отдел"}
                <button
                  onClick={() => {
                    const next = { ...formData, department_id: null };
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

            {formData.position_id && (
              <span className={styles.activeFilterTag}>
                {positions.find(
                  (pos) => String(pos.id) === String(formData.position_id),
                )?.name || "Должность"}
                <button
                  onClick={() => {
                    const next = { ...formData, position_id: null };
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
                {formData.direction === "entry"
                  ? t("entry") || "Вход"
                  : t("exit") || "Выход"}
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

            {formData.selectedDoorIds?.length > 0 && (
              <span className={styles.activeFilterTag}>
                {doors
                  .filter((dep) =>
                    formData.selectedDoorIds.includes(String(dep.id)),
                  )
                  .map((dep) => dep.name)
                  .join(", ") || "Двери"}
                <button
                  onClick={() => {
                    const next = { ...formData, selectedDoorIds: [] };
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
              <EventCard
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
const FilterScreen = ({
  departments,
  positions,
  doors,
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

  const handleReset = () => setLocalForm(initialFormData);

  return (
    <div className={styles.filterPage}>
      <div className={styles.filterHeader}>
        <span className={styles.filterTitle}>{t("filters") || "Фильтры"}</span>
      </div>

      <div className={styles.filterBody}>
        <div className={styles.filterRow}>
          <div className={styles.filterField}>
            <label className={styles.fieldLabel}>Дата от</label>
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
            <label className={styles.fieldLabel}>Дата до</label>
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
          <label className={styles.fieldLabel}>Отдел</label>
          <select
            className={styles.select}
            name="department_id"
            value={
              localForm.department_id ? String(localForm.department_id) : ""
            }
            onChange={handleChange}
          >
            <option value="">Все</option>
            {departments.map((dep) => (
              <option key={dep.id} value={String(dep.id)}>
                {dep.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterSection}>
          <label className={styles.fieldLabel}>Должность</label>
          <select
            className={styles.select}
            name="position_id"
            value={localForm.position_id || ""}
            onChange={handleChange}
          >
            <option value="">Все</option>
            {positions.map((pos) => (
              <option key={pos.id} value={pos.id}>
                {pos.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterSection}>
          <label className={styles.fieldLabel}>Двери</label>
          <select
            className={styles.select}
            multiple
            value={localForm.selectedDoorIds || []}
            onChange={(e) => {
              const values = Array.from(
                e.target.selectedOptions,
                (option) => option.value,
              );
              setLocalForm((prev) => ({ ...prev, selectedDoorIds: values }));
            }}
          >
            {doors.map((door) => (
              <option key={door.id} value={door.id}>
                {door.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterSection}>
          <label className={styles.fieldLabel}>Направление</label>
          <div className={styles.directionGroup}>
            {[
              { value: "", label: "Все" },
              { value: "entry", label: t("entry") || "Вход" },
              { value: "exit", label: t("exit") || "Выход" },
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

// ── Event Card ─────────────────────────────────────────────────────────────────
const EventCard = ({ event, t, innerRef }) => {
  const fullName =
    [event.employee.last_name, event.employee.first_name]
      .filter(Boolean)
      .join(" ") || t("unknown");

  const eventTime = event.date || "";
  const formattedTime = eventTime
    ? new Date(eventTime).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const isIn = event.direction === "entry";

  return (
    <div className={styles.card} ref={innerRef}>
      <div className={styles.cardAvatar}>
        {event.photo ? (
          <img
            src={`/api/face-passes/image/${event.photo}`}
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
        <div className={styles.cardHeader}>
          <p className={styles.cardName}>
            {fullName} {event?.employee_id}
          </p>
          <p className={styles.cardSub}>
            {event?.employee?.position?.name || "—"}
          </p>
        </div>

        <div className={styles.cardRow}>
          <p className={styles.cardMeta}>
            {event?.employee?.department?.name || ""}
          </p>
          <span
            className={`${styles.dirBadge} ${isIn ? styles.dirIn : styles.dirOut}`}
          >
            {isIn ? t("entry") || "Вход" : t("exit") || "Выход"}
          </span>
        </div>

        <div className={styles.cardRow}>
          <p className={styles.cardMeta}>{event?.door?.name || ""}</p>
          <span className={styles.cardTime}>{formattedTime}</span>
        </div>
      </div>
    </div>
  );
};

export default FacePassesPageTelegram;
