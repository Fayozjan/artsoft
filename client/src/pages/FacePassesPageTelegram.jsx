import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
  FacePassesService,
  getActiveDoors,
  getActivePositions,
  getActiveDepartments,
} from "../api";
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
  IconDoor,
  IconClock,
  IconBuilding,
  IconBriefcase,
  IconMapPin,
  IconHash,
  IconScan,
} from "../components/tg/tgIcons";
import { toneStyle } from "../utils/attendanceTelegram";

import styles from "./FacePassesPageTelegram.module.scss";
import { usePullToRefresh } from "../hooks/usePullToRefresh";

const PAGE_SIZE = 50;

// Ключ дня в локальной зоне устройства — группировка карточек по дате съёмки
const dayKeyOf = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

const isSameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const dayLabel = (iso, t) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(d, today)) return t("attendanceTg.today");
  if (isSameDay(d, yesterday)) return t("attendanceTg.yesterday");

  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    weekday: "short",
  });
};

// ── Main page ──────────────────────────────────────────────────────────────────
const FacePassesPageTelegram = () => {
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [data, setData] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions] = useState([]);
  const [doors, setDoors] = useState([]);
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
          <h1 className={styles.heroTitle}>{t("facePasses")}</h1>
          {totalItems > 0 && <span className={styles.heroCount}>{totalItems}</span>}
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
                <span className={styles.filterBadge}>{activeFiltersCount}</span>
              )}
            </button>
          </div>

          {!loading && data.length > 0 && (
            <div className={styles.statsRow}>
              <div className={styles.statCard}>
                <span className={styles.statIcon}>
                  <IconDoor />
                </span>
                <span className={styles.statValue}>{totalItems}</span>
                <span className={styles.statLabel}>
                  {t("totalFacePassesLabel")}
                </span>
              </div>
              <div className={styles.statCard} style={toneStyle("green")}>
                <span className={styles.statIcon}>
                  <IconLogIn />
                </span>
                <span className={styles.statValue}>{entryCount}</span>
                <span className={styles.statLabel}>{t("entry")}</span>
              </div>
              <div className={styles.statCard} style={toneStyle("red")}>
                <span className={styles.statIcon}>
                  <IconLogOut />
                </span>
                <span className={styles.statValue}>{exitCount}</span>
                <span className={styles.statLabel}>{t("exit")}</span>
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
                    `${t("fromLabel")} ${new Date(formData.start_date).toLocaleString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`}
                  {formData.end_date &&
                    ` ${t("toLabel")} ${new Date(formData.end_date).toLocaleString("ru-RU", {
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

              {formData.department_id && (
                <span className={styles.activeFilterTag}>
                  {departments.find(
                    (dep) => String(dep.id) === String(formData.department_id),
                  )?.name || t("department")}
                  <button
                    onClick={() => {
                      const next = { ...formData, department_id: null };
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

              {formData.position_id && (
                <span className={styles.activeFilterTag}>
                  {positions.find(
                    (pos) => String(pos.id) === String(formData.position_id),
                  )?.name || t("position")}
                  <button
                    onClick={() => {
                      const next = { ...formData, position_id: null };
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
                    <IconClose />
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
                    .join(", ") || t("doors")}
                  <button
                    onClick={() => {
                      const next = { ...formData, selectedDoorIds: [] };
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
                  <IconScan />
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
                    <EventCard
                      key={event.id || globalIdx}
                      innerRef={globalIdx === data.length - 5 ? sentinelRef : null}
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
            <label className={styles.fieldLabel}>{t("dateFrom")}</label>
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
            <label className={styles.fieldLabel}>{t("dateTo")}</label>
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
          <label className={styles.fieldLabel}>{t("department")}</label>
          <select
            className={styles.select}
            name="department_id"
            value={
              localForm.department_id ? String(localForm.department_id) : ""
            }
            onChange={handleChange}
          >
            <option value="">{t("all")}</option>
            {departments.map((dep) => (
              <option key={dep.id} value={String(dep.id)}>
                {dep.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterSection}>
          <label className={styles.fieldLabel}>{t("position")}</label>
          <select
            className={styles.select}
            name="position_id"
            value={localForm.position_id || ""}
            onChange={handleChange}
          >
            <option value="">{t("all")}</option>
            {positions.map((pos) => (
              <option key={pos.id} value={pos.id}>
                {pos.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterSection}>
          <label className={styles.fieldLabel}>{t("doors")}</label>
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
          <label className={styles.fieldLabel}>{t("direction")}</label>
          <div className={styles.directionGroup}>
            {[
              { value: "", label: t("all") },
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

// ── Event Card ─────────────────────────────────────────────────────────────────
const EventCard = ({ event, t, innerRef, onOpen }) => {
  const fullName =
    [event.employee.last_name, event.employee.first_name]
      .filter(Boolean)
      .join(" ") || t("unknown");

  const eventTime = event.date || "";
  const formattedTime = eventTime
    ? new Date(eventTime).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const isIn = event.direction === "entry";
  const tone = isIn ? "green" : "red";

  return (
    <button
      type="button"
      className={styles.card}
      style={toneStyle(tone)}
      ref={innerRef}
      onClick={onOpen}
    >
      <span className={styles.cardAvatar}>
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
      </span>

      <span className={styles.cardBody}>
        <span className={styles.cardName}>{fullName}</span>
        <span className={styles.cardSub}>
          {[event?.employee?.position?.name, event?.employee?.department?.name]
            .filter(Boolean)
            .join(" · ") || "—"}
        </span>

        <span className={styles.cardChips}>
          <span className={styles.chip}>
            <IconDoor />
            {event?.door?.name || "—"}
          </span>
          <span className={styles.chip}>
            <IconClock />
            {formattedTime}
          </span>
        </span>
      </span>

      <span className={`${styles.dirPill} ${isIn ? styles.dirIn : styles.dirOut}`}>
        {isIn ? <IconLogIn /> : <IconLogOut />}
        {isIn ? t("entry") || "Вход" : t("exit") || "Выход"}
      </span>
    </button>
  );
};

// ── Event detail sheet ─────────────────────────────────────────────────────────
const EventSheet = ({ event, isOpen, onClose, t }) => {
  if (!event) {
    return <TgSheet isOpen={isOpen} onClose={onClose} title="" />;
  }

  const fullName =
    [event.employee.last_name, event.employee.first_name]
      .filter(Boolean)
      .join(" ") || t("unknown");

  const isIn = event.direction === "entry";
  const tone = isIn ? "green" : "red";
  const eventDate = event.date ? new Date(event.date) : null;

  const dateText = eventDate
    ? eventDate.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";
  const timeText = eventDate
    ? eventDate.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <TgSheet
      isOpen={isOpen}
      onClose={onClose}
      title={fullName}
      subtitle={event?.employee?.position?.name}
    >
      <div className={styles.sheet} style={toneStyle(tone)}>
        <div className={styles.sheetTop}>
          <span className={styles.sheetAvatar}>
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
          </span>

          <span className={`${styles.dirPill} ${isIn ? styles.dirIn : styles.dirOut}`}>
            {isIn ? <IconLogIn /> : <IconLogOut />}
            {isIn ? t("entry") || "Вход" : t("exit") || "Выход"}
          </span>
        </div>

        <div className={styles.times}>
          <div className={styles.timeCell}>
            <span className={styles.timeLabel}>{t("date")}</span>
            <b>{dateText}</b>
          </div>
          <div className={styles.timeCell}>
            <span className={styles.timeLabel}>{t("time")}</span>
            <b>{timeText}</b>
          </div>
          <div className={styles.timeCell}>
            <span className={styles.timeLabel}>{t("door")}</span>
            <b>{event?.door?.name || "—"}</b>
          </div>
        </div>

        <ul className={styles.info}>
          <InfoRow
            icon={<IconHash />}
            label={t("tabNumber")}
            value={event?.employee_id}
          />
          <InfoRow
            icon={<IconBriefcase />}
            label={t("position")}
            value={event?.employee?.position?.name}
          />
          <InfoRow
            icon={<IconBuilding />}
            label={t("department")}
            value={event?.employee?.department?.name}
          />
          <InfoRow
            icon={<IconMapPin />}
            label={t("branch")}
            value={event?.employee?.branch?.name}
          />
          <InfoRow
            icon={<IconScan />}
            label={t("source")}
            value={event?.source ? t(event.source) : undefined}
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

export default FacePassesPageTelegram;
