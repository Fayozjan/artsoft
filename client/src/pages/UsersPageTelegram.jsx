import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";

import {
  getUsers,
  deleteUserById,
  getLoginLockouts,
  unlockUserLogin,
} from "../api";
import { useAlertStore } from "../stores/alertStore";
import { usePermissionsTelegram } from "../hooks/usePermissionsTelegram";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { useScreenStack } from "../context/ScreenStackContext";

import CenterModal from "../components/CenterModal";
import UserFormScreenTelegram from "../components/UserFormScreenTelegram";
import {
  IconSearch,
  IconClose,
  IconPlus,
  IconTrash,
  IconLock,
  IconUnlock,
  IconShield,
  IconUsers,
  IconUserCheck,
  IconUserOff,
  IconChevronRight,
} from "../components/tg/tgIcons";

import styles from "./UsersPageTelegram.module.scss";

const PAGE_SIZE = 50;

const STATUS_PARAM = { all: "", active: "true", inactive: "false" };

// Уровень доступа → подпись и цвет чипа.
const ACCESS = {
  absolute: { label: "access_absolute", tone: styles.chipPurple },
  branch: { label: "access_branch", tone: styles.chipBlue },
  department: { label: "access_department", tone: styles.chipAmber },
  employee: { label: "employee", tone: styles.chipGray },
};

const VIEW_MODE = { absolute: "allBranches", branch: "byBranch" };

// Сервер отдаёт employeeFullName как «Фамилия Имя Отчество (id)».
const parseEmployee = (fullName) => {
  if (!fullName) return { name: "", id: null };
  const match = /^(.*?)\s*\((\d+)\)$/.exec(fullName);
  return match ? { name: match[1], id: match[2] } : { name: fullName, id: null };
};

const initialsOf = (source) => {
  const parts = (source || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
};

// Один и тот же логин — всегда один и тот же оттенок аватара.
const hueOf = (text) => {
  let hash = 0;
  for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return hash;
};

const formatTime = (value) =>
  new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const SkeletonCard = () => (
  <div className={styles.skeleton}>
    <div className={styles.skRow}>
      <span className={styles.skAvatar} />
      <div className={styles.skLines}>
        <span className={styles.skLine} style={{ width: "45%", height: 16 }} />
        <span className={styles.skLine} style={{ width: "70%" }} />
      </div>
    </div>
    <span className={styles.skLine} style={{ width: "60%", height: 22 }} />
    <span className={styles.skLine} style={{ width: "100%", height: 6 }} />
  </div>
);

const UserCard = ({
  item,
  totalMenus,
  lock,
  canEdit,
  canDelete,
  unlocking,
  onOpen,
  onDelete,
  onUnlock,
  innerRef,
  t,
}) => {
  const employee = parseEmployee(item.employeeFullName);
  const access = ACCESS[item.access_level];
  const viewMode = VIEW_MODE[item.view_mode];
  const active = item.status === true || item.status === "active";
  const menuCount = item.menuCount ?? 0;
  const menuPercent =
    totalMenus > 0 ? Math.min(100, (menuCount / totalMenus) * 100) : 0;

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
        <div
          className={styles.avatar}
          style={{ "--hue": hueOf(item.username || "") }}
        >
          {initialsOf(employee.name || item.username)}
          <span
            className={`${styles.avatarDot} ${active ? styles.dotOn : styles.dotOff}`}
          />
        </div>

        <div className={styles.who}>
          <h3 className={styles.username}>{item.username}</h3>
          <p className={styles.person}>
            <span>{employee.name || "—"}</span>
            {employee.id && <em>#{employee.id}</em>}
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
        {access && (
          <span className={`${styles.chip} ${access.tone}`}>
            <IconShield />
            {t(access.label)}
          </span>
        )}
        {viewMode && (
          <span className={`${styles.chip} ${styles.chipGray}`}>{t(viewMode)}</span>
        )}
      </div>

      {totalMenus > 0 && (
        <div className={styles.meter}>
          <div className={styles.meterHead}>
            <span>{t("menusAllowed")}</span>
            <b>
              {menuCount}
              <small> / {totalMenus}</small>
            </b>
          </div>
          <div className={styles.meterTrack}>
            <span className={styles.meterFill} style={{ width: `${menuPercent}%` }} />
          </div>
        </div>
      )}

      {lock && (
        <div className={styles.lock} onClick={(e) => e.stopPropagation()}>
          <span className={styles.lockIcon}>
            <IconLock />
          </span>
          <span className={styles.lockText}>
            <b>{t("loginLockedUntil", { time: formatTime(lock.lockedUntil) })}</b>
            <small>
              {lock.retryAfterMinutes} {t("minutesShort")}
            </small>
          </span>
          {canEdit && (
            <button
              type="button"
              className={styles.unlockBtn}
              disabled={unlocking}
              onClick={() => onUnlock(item)}
            >
              <IconUnlock />
              {t("unlockLogin")}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Страница «Настройки → Логины» в Telegram: сводка-фильтр, поиск и карточки логинов.
// Добавление и правка открываются экраном поверх (стек экранов), как у сотрудников.
const UsersPageTelegram = ({ routePath = "/users" }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertStore();
  const { pushScreen } = useScreenStack();
  const { canAdd, canEdit, canDelete } = usePermissionsTelegram(routePath);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [counts, setCounts] = useState({ all: null, active: null });
  const [totalMenus, setTotalMenus] = useState(0);
  const [lockouts, setLockouts] = useState({});
  const [unlockingId, setUnlockingId] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const scrollRef = useRef(null);
  const searchRef = useRef("");
  const filterRef = useRef("all");
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
        const { data: rows, pagination, totalMenus: menus } = await getUsers({
          page,
          pageSize: PAGE_SIZE,
          filters: {
            search: searchRef.current,
            status: STATUS_PARAM[filterRef.current],
          },
        });
        // ответ устаревшего запроса (успели сменить поиск/фильтр) — выбрасываем
        if (requestId !== requestIdRef.current) return;

        const list = rows || [];
        setData((prev) => (page === 1 ? list : [...prev, ...list]));
        setTotalMenus(menus ?? 0);
        pageRef.current = page;
        hasMoreRef.current = page < (pagination?.totalPages || 1);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        console.error("Ошибка при получении логинов:", err);
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
      const [all, active] = await Promise.all([
        getUsers({ page: 1, pageSize: 1, filters: {} }),
        getUsers({ page: 1, pageSize: 1, filters: { status: "true" } }),
      ]);
      setCounts({
        all: all.pagination?.totalItems ?? 0,
        active: active.pagination?.totalItems ?? 0,
      });
    } catch (err) {
      console.error("Ошибка при получении счётчиков:", err);
    }
  }, []);

  // Активные блокировки входа: ключ — username в нижнем регистре
  const fetchLockouts = useCallback(async () => {
    try {
      const list = await getLoginLockouts();
      setLockouts(
        Object.fromEntries(list.map((l) => [l.username.toLowerCase(), l])),
      );
    } catch (err) {
      console.error("Ошибка при получении блокировок:", err);
    }
  }, []);

  const refreshAll = useCallback(() => {
    fetchPage(1, true);
    fetchCounts();
    fetchLockouts();
  }, [fetchPage, fetchCounts, fetchLockouts]);

  useEffect(() => {
    fetchPage(1);
    fetchCounts();
    fetchLockouts();
    return () => clearTimeout(searchTimerRef.current);
  }, []);

  // блокировки истекают сами — подтягиваем, чтобы плашка не висела просроченной
  useEffect(() => {
    const id = setInterval(fetchLockouts, 60_000);
    return () => clearInterval(id);
  }, [fetchLockouts]);

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
      id ? `edit-user-${id}` : "add-user",
      <UserFormScreenTelegram id={id} onSaved={refreshAll} />,
    );

  const handleDelete = async () => {
    const id = deleteId;
    setDeleteId(null);
    if (!id) return;
    try {
      await deleteUserById(id);
      showAlert(t("success"), "success");
      refreshAll();
    } catch (err) {
      console.error("Ошибка при удалении:", err);
      showAlert(t("error"), "error");
    }
  };

  const handleUnlock = async (item) => {
    setUnlockingId(item.id);
    try {
      await unlockUserLogin(item.id);
      showAlert(t("loginUnlocked"), "success");
      fetchLockouts();
    } catch (err) {
      console.error("Ошибка при снятии блокировки:", err);
      showAlert(t("error"), "error");
    } finally {
      setUnlockingId(null);
    }
  };

  const total = counts.all;
  const inactiveCount = total === null ? null : total - (counts.active ?? 0);
  const tiles = [
    { key: "all", label: t("all"), icon: <IconUsers />, value: total, tone: styles.toneIndigo },
    { key: "active", label: t("enabled"), icon: <IconUserCheck />, value: counts.active, tone: styles.toneGreen },
    { key: "inactive", label: t("disabled"), icon: <IconUserOff />, value: inactiveCount, tone: styles.toneRed },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.topGlass} />

      <div className={styles.main} id="scroll-container" ref={scrollRef}>
        <header className={styles.head}>
          <h1 className={styles.title}>{t("users")}</h1>
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
        </div>

        <div className={styles.list}>
          {loading ? (
            Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} />)
          ) : data.length === 0 ? (
            <div className={styles.empty}>
              <span className={styles.emptyIcon}>
                <IconUsers />
              </span>
              <p>{t("noData")}</p>
            </div>
          ) : (
            data.map((item, index) => (
              <UserCard
                key={item.id}
                item={item}
                totalMenus={totalMenus}
                lock={lockouts[item.username?.toLowerCase()]}
                canEdit={canEdit}
                canDelete={canDelete}
                unlocking={unlockingId === item.id}
                onOpen={openForm}
                onDelete={setDeleteId}
                onUnlock={handleUnlock}
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
          aria-label={t("addUser")}
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

export default UsersPageTelegram;
