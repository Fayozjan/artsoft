import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { getCanteenMeals } from "../api";
import { Icons } from "../icons/icons";

import styles from "./CanteenMealsModal.module.scss";

const PAGE_SIZE = 50;

// Разбор счётчика экрана столовой: кто именно получил порцию или получил отказ.
// Открывается поверх экрана раздачи, опрос экрана при этом не прерывается.
const CanteenMealsModal = ({ status, date, deviceId, onClose }) => {
  const { t } = useTranslation();

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const debounceRef = useRef(null);

  const fetchPage = useCallback(
    async (nextPage, term) => {
      setLoading(true);
      try {
        const res = await getCanteenMeals({
          page: nextPage,
          pageSize: PAGE_SIZE,
          filters: JSON.stringify({
            status,
            date_from: date,
            date_to: date,
            search: term || undefined,
            device_id: deviceId || undefined,
          }),
        });
        // догрузка добавляет строки, новый поиск — заменяет
        setRows((prev) =>
          nextPage === 1 ? res.data || [] : [...prev, ...(res.data || [])],
        );
        setTotal(res.pagination?.totalItems ?? 0);
        setPage(res.pagination?.currentPage ?? nextPage);
      } catch (err) {
        console.error("Ошибка при получении списка порций:", err.message);
      } finally {
        setLoading(false);
      }
    },
    [status, date, deviceId],
  );

  useEffect(() => {
    fetchPage(1, "");
  }, [fetchPage]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPage(1, value), 400);
  };

  const denyText = (reason) =>
    reason === "limit_reached"
      ? t("canteenLimitReached")
      : t("canteenNoAllowance");

  const formatTime = (value) =>
    new Date(value).toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const served = status === "served";
  const accent = served ? "#10b981" : "#ef4444";

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleWrap}>
            <span className={styles.dot} style={{ background: accent }} />
            <h2 className={styles.title}>
              {served ? t("servedToday") : t("deniedToday")}
            </h2>
            <span className={styles.count} style={{ color: accent }}>
              {total}
            </span>
          </div>

          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            title={t("close")}
          >
            {Icons.clear}
          </button>
        </div>

        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>{Icons.search}</span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder={t("search")}
            value={search}
            onChange={handleSearch}
            autoFocus
          />
        </div>

        <div className={styles.list}>
          {rows.length > 0 ? (
            rows.map((row) => (
              <div key={row.id} className={styles.row}>
                {row.employeePhoto ? (
                  <img
                    className={styles.avatar}
                    src={`/api/employees/image/${row.employeePhoto}`}
                    alt={row.employeeFullName || ""}
                  />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    {(row.employeeFullName || "?").charAt(0)}
                  </div>
                )}

                <div className={styles.rowInfo}>
                  <span className={styles.rowName}>{row.employeeFullName}</span>
                  <span className={styles.rowMeta}>
                    {[row.departmentName, row.deviceName]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </span>
                </div>

                <div className={styles.rowRight}>
                  <span className={styles.rowTime}>{formatTime(row.date)}</span>
                  <span className={styles.rowTag} style={{ color: accent }}>
                    {served
                      ? `${t("dailyPortionLimit")}: ${row.daily_limit}`
                      : denyText(row.deny_reason)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className={styles.empty}>
              {loading ? t("loading") : t("noData")}
            </p>
          )}

          {rows.length < total && (
            <button
              type="button"
              className={styles.moreBtn}
              disabled={loading}
              onClick={() => fetchPage(page + 1, search)}
            >
              {loading ? t("loading") : t("showMore")}
            </button>
          )}
        </div>

        <div className={styles.footer}>
          {t("shown")} {rows.length} {t("of")} {total}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default CanteenMealsModal;
