import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { getVehiclePasses } from "../api/vehiclePasses";
import { getActiveGates } from "../api";
import { useAlertStore } from "../stores/alertStore";
import { useScreenStack } from "../context/ScreenStackContext";

import Loading from "../components/LoadingTelegram";
import TgSheet from "../components/tg/TgSheet";
import {
  IconSearch,
  IconClose,
  IconFilter,
  IconLogIn,
  IconLogOut,
  IconCar,
  IconBarrier,
  IconClock,
  IconMapPin,
} from "../components/tg/tgIcons";
import { toneStyle } from "../utils/attendanceTelegram";

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

// Сервер отдаёт date как готовую строку "ДД.ММ.ГГГГ, ЧЧ:ММ:СС" (Asia/Tashkent) —
// парсить её через `new Date()` ненадёжно (движки WebView расходятся), поэтому
// день извлекаем из строки, а Date() строим только из чистых DD.MM.YYYY.
const datePartOf = (raw) => (raw || "").split(", ")[0] || "";

const dayKeyOf = (raw) => datePartOf(raw);

const dayLabel = (raw, t) => {
  const datePart = datePartOf(raw);
  if (!datePart) return "";

  const fmt = (d) =>
    d.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (datePart === fmt(now)) return t("attendanceTg.today");
  if (datePart === fmt(yesterday)) return t("attendanceTg.yesterday");

  const [dd, mm, yyyy] = datePart.split(".").map(Number);
  return new Date(yyyy, mm - 1, dd).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "short",
  });
};

// ── Main page ──────────────────────────────────────────────────────────────────
const VehiclePassesPageTelegram = () => {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [data, setData] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [gates, setGates] = useState([]);
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);
  const [shownEvent, setShownEvent] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);

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
    start_date: `${today}T00:00`,
    end_date: `${today}T23:59`,
    direction: "",
    selectedGateIds: [],
  };

  const [formData, setFormData] = useState(initialFormData);
  const formDataRef = useRef(initialFormData);

  // ── Active filters count ─────────────────────────────────────────────────────
  const countActiveFilters = (fd) => {
    let count = 0;
    if (fd.start_date) count++;
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
      setTotalItems(pagination?.totalItems ?? 0);
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

  const openEvent = (event) => {
    setShownEvent(event);
    setSheetOpen(true);
  };

  usePullToRefresh(() => fetchEvents(), scrollRef, loading);

  // ── Stats: counts among currently loaded events ─────────────────────────────
  const { entryCount, exitCount } = useMemo(
    () => ({
      entryCount: data.filter((x) => x.direction === "entry").length,
      exitCount: data.filter((x) => x.direction === "exit").length,
    }),
    [data],
  );

  // ── Group loaded events by day ───────────────────────────────────────────────
  const groups = useMemo(() => {
    const list = [];
    let lastKey = null;
    data.forEach((event) => {
      const key = dayKeyOf(event.date);
      if (key !== lastKey) {
        list.push({ key, label: dayLabel(event.date, t), items: [] });
        lastKey = key;
      }
      list[list.length - 1].items.push(event);
    });
    return list;
  }, [data, t]);

  let renderedCount = 0;

  return (
    <div className={styles.page}>
      <div className={styles.header} />

      <div className={styles.main} id="scroll-container" ref={scrollRef}>
        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>{t("vehicle-passes")}</h1>
          {totalItems > 0 && (
            <span className={styles.heroCount}>{totalItems}</span>
          )}
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
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery.length > 0 && (
                <button
                  className={styles.clearBtn}
                  onClick={() => setSearchQuery("")}
                >
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
                <span className={styles.filterBadge}>
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>

          {!loading && data.length > 0 && (
            <div className={styles.statsRow}>
              <div className={styles.statCard}>
                <span className={styles.statIcon}>
                  <IconCar />
                </span>
                <span className={styles.statValue}>{totalItems}</span>
                <span className={styles.statLabel}>
                  {t("totalPassesLabel")}
                </span>
              </div>
              <div className={styles.statCard} style={toneStyle("green")}>
                <span className={styles.statIcon}>
                  <IconLogIn />
                </span>
                <span className={styles.statValue}>{entryCount}</span>
                <span className={styles.statLabel}>{t("forward")}</span>
              </div>
              <div className={styles.statCard} style={toneStyle("red")}>
                <span className={styles.statIcon}>
                  <IconLogOut />
                </span>
                <span className={styles.statValue}>{exitCount}</span>
                <span className={styles.statLabel}>{t("reverse")}</span>
              </div>
            </div>
          )}

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
                    <IconClose />
                  </button>
                </span>
              )}

              {formData.direction && (
                <span className={styles.activeFilterTag}>
                  {formData.direction === "entry"
                    ? t("forward")
                    : t("reverse")}
                  <button
                    onClick={() => {
                      const next = { ...formData, direction: "" };
                      setFormData(next);
                      formDataRef.current = next;
                      setActiveFiltersCount(countActiveFilters(next));
                      fetchEvents(1, next);
                    }}
                  >
                    <IconClose />
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
                    <IconClose />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Card list */}
        {loading ? (
          <div className={styles.centerLoading}>
            <Loading />
          </div>
        ) : (
          <div className={styles.cardList} ref={listRef}>
            {data.length === 0 && (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>
                  <IconCar />
                </span>
                <p>{t("noData")}</p>
              </div>
            )}
            {groups.map((group) => (
              <div key={group.key} className={styles.dateGroup}>
                <div className={styles.dateHeader}>{group.label}</div>
                {group.items.map((event) => {
                  const globalIdx = renderedCount++;
                  return (
                    <VehicleCard
                      key={event.id || globalIdx}
                      innerRef={
                        globalIdx === data.length - 5 ? sentinelRef : null
                      }
                      event={event}
                      onOpen={() => openEvent(event)}
                      t={t}
                    />
                  );
                })}
              </div>
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

      <EventSheet
        event={shownEvent}
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        t={t}
      />
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

      <div className={styles.filterFooter}>
        <button className={styles.resetBtn} onClick={handleReset}>
          {t("clearAll") || "Сбросить"}
        </button>
        <button className={styles.applyBtn} onClick={() => onApply(localForm)}>
          {t("apply") || "Применить"}
        </button>
      </div>
    </div>
  );
};

// ── Vehicle Card ───────────────────────────────────────────────────────────────
const VehicleCard = ({ event, t, innerRef, onOpen }) => {
  const plate = parsePlate(event?.plate_number);
  const branchName = event.branch_name || "";
  const gateName = event.gate_name || "—";

  const timeOnly = (event.date || "").split(", ").pop() || "—";

  const isIn = event.direction === "entry";
  const tone = isIn ? "green" : event.direction === "exit" ? "red" : "gray";

  return (
    <button
      type="button"
      className={styles.card}
      style={toneStyle(tone)}
      ref={innerRef}
      onClick={onOpen}
    >
      <span className={styles.cardPhoto}>
        {event.photo ? (
          <img
            src={`/api/vehicle-passes/image/${event.photo}`}
            alt={plate.formatted}
            loading="lazy"
          />
        ) : (
          <span className={styles.photoFallback}>
            <IconCar />
          </span>
        )}
      </span>

      <span className={styles.cardBody}>
        <span className={styles.cardName}>{plate.formatted}</span>
        <span className={styles.cardSub}>{branchName || "—"}</span>

        <span className={styles.cardChips}>
          <span className={styles.chip}>
            <IconBarrier />
            {gateName}
          </span>
          <span className={styles.chip}>
            <IconClock />
            {timeOnly}
          </span>
        </span>
      </span>

      <span
        className={`${styles.dirPill} ${isIn ? styles.dirIn : styles.dirOut}`}
      >
        {isIn ? <IconLogIn /> : <IconLogOut />}
        {isIn ? t("forward") : event.direction === "exit" ? t("reverse") : t("unknown")}
      </span>
    </button>
  );
};

// ── Event detail sheet ─────────────────────────────────────────────────────────
const EventSheet = ({ event, isOpen, onClose, t }) => {
  if (!event) {
    return <TgSheet isOpen={isOpen} onClose={onClose} title="" />;
  }

  const plate = parsePlate(event.plate_number);
  const isIn = event.direction === "entry";
  const tone = isIn ? "green" : event.direction === "exit" ? "red" : "gray";

  const [datePart, timePart] = (event.date || "").split(", ");

  return (
    <TgSheet
      isOpen={isOpen}
      onClose={onClose}
      title={plate.formatted}
      subtitle={event.branch_name}
    >
      <div className={styles.sheet} style={toneStyle(tone)}>
        <span className={styles.sheetPhoto}>
          {event.photo ? (
            <img
              src={`/api/vehicle-passes/image/${event.photo}`}
              alt={plate.formatted}
              loading="lazy"
            />
          ) : (
            <span className={styles.photoFallback}>
              <IconCar />
            </span>
          )}
          <span
            className={`${styles.dirPill} ${isIn ? styles.dirIn : styles.dirOut}`}
          >
            {isIn ? <IconLogIn /> : <IconLogOut />}
            {isIn
              ? t("forward")
              : event.direction === "exit"
                ? t("reverse")
                : t("unknown")}
          </span>
        </span>

        <div className={styles.times}>
          <div className={styles.timeCell}>
            <span className={styles.timeLabel}>{t("date")}</span>
            <b>{datePart || "—"}</b>
          </div>
          <div className={styles.timeCell}>
            <span className={styles.timeLabel}>{t("time")}</span>
            <b>{timePart || "—"}</b>
          </div>
          <div className={styles.timeCell}>
            <span className={styles.timeLabel}>{t("gates")}</span>
            <b>{event.gate_name || "—"}</b>
          </div>
        </div>

        <ul className={styles.info}>
          <InfoRow
            icon={<IconMapPin />}
            label={t("branch")}
            value={event.branch_name}
          />
        </ul>
      </div>
    </TgSheet>
  );
};

const InfoRow = ({ icon, label, value }) =>
  value ? (
    <li className={styles.infoRow}>
      <span className={styles.infoIcon}>{icon}</span>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoValue}>{value}</span>
    </li>
  ) : null;

export default VehiclePassesPageTelegram;
