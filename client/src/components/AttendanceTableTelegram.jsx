import { useEffect, useMemo, useRef } from "react";

import styles from "./AttendanceTableTelegram.module.scss";

const STATUS_KEYS = ["present", "absent", "late", "inside", "left"];

const STATUS_META = {
  present: { color: "#16a34a", bg: "#f0fdf4", label: "Пришел" },
  absent: { color: "#dc2626", bg: "#fef2f2", label: "Не пришел" },
  late: { color: "#d97706", bg: "#fffbeb", label: "Опоздал" },
  inside: { color: "#2563eb", bg: "#eff6ff", label: "На месте" },
  left: { color: "#7c3aed", bg: "#f5f3ff", label: "Ушел" },
};

// ── Employee card ─────────────────────────────────────────────────────────────
const EmployeeCard = ({ emp }) => {
  const fullName = emp.employeeFullName || "—";
  const initials = fullName.charAt(0).toUpperCase();
  const activeStatuses = STATUS_KEYS.filter((k) => emp[k] === true);

  return (
    <div className={styles.card}>
      <div className={styles.cardAvatar}>
        {emp.employeePhoto ? (
          <img
            src={`/api/employees/image/${emp.employeePhoto}`}
            alt={fullName}
            loading="lazy"
          />
        ) : (
          <span className={styles.avatarFallback}>{initials}</span>
        )}
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardInfoRow}>
          <div className={styles.cardDetails}>
            <p className={styles.cardName}>{fullName}</p>
            <p className={styles.cardSub}>{emp.positionName || "—"}</p>
            <p className={styles.cardMeta}>{emp.departmentName || ""}</p>
          </div>

          <div className={styles.cardTime}>
            {emp.firstEntry && (
              <div className={styles.timeBlock}>
                <span className={styles.timeLabel}>Вход</span>
                <span className={styles.timeValue}>{emp.firstEntry}</span>
              </div>
            )}
            {emp.lastExit && (
              <div className={styles.timeBlock}>
                <span className={styles.timeLabel}>Выход</span>
                <span className={styles.timeValue}>{emp.lastExit}</span>
              </div>
            )}
          </div>
        </div>

        {activeStatuses.length > 0 && (
          <div className={styles.statusBadges}>
            {activeStatuses.map((k) => {
              const m = STATUS_META[k];
              return (
                <span
                  key={k}
                  className={styles.statusBadge}
                  style={{ "--badge-color": m.color, "--badge-bg": m.bg }}
                >
                  {m.label}
                  {k === "late" && emp.lateMinutes
                    ? ` ${emp.lateMinutes} мин`
                    : ""}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const AttendanceTableTelegram = ({
  rowData = {},
  search = "",
  activeStatusFilters = new Set(),
  onScroll,
}) => {
  const listRef = useRef(null);

  const employees = useMemo(() => {
    if (!rowData?.employees) return [];

    const presentIds = new Set(rowData.present?.map((e) => e.employeeId));
    const absentIds = new Set(rowData.absent?.map((e) => e.employeeId));
    const insideIds = new Set(rowData.inside?.map((e) => e.employeeId));
    const leftIds = new Set(rowData.left?.map((e) => e.employeeId));
    const lateIds = new Set(rowData.late?.map((e) => e.employeeId));

    const presentMap = new Map(
      rowData.present?.map((e) => [e.employeeId, e.firstEntry]),
    );
    const leftMap = new Map(
      rowData.left?.map((e) => [e.employeeId, e.lastExit]),
    );
    const lateMap = new Map(
      rowData.late?.map((e) => [e.employeeId, e.lateMinutes]),
    );

    return rowData.employees.map((emp) => ({
      ...emp,
      employeeId: emp.id,
      present: presentIds.has(emp.id),
      absent: absentIds.has(emp.id),
      inside: insideIds.has(emp.id),
      left: leftIds.has(emp.id),
      late: lateIds.has(emp.id),
      firstEntry: presentMap.get(emp.id) || null,
      lastExit: leftMap.get(emp.id) || null,
      lateMinutes: lateMap.get(emp.id) || 0,
    }));
  }, [rowData]);

  // Filter by search query + active status chips
  const filteredEmployees = useMemo(() => {
    let result = employees;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (emp) =>
          emp.employeeFullName?.toLowerCase().includes(q) ||
          emp.departmentName?.toLowerCase().includes(q) ||
          emp.positionName?.toLowerCase().includes(q) ||
          String(emp.employeeId).includes(q),
      );
    }

    if (activeStatusFilters.size > 0) {
      result = result.filter((emp) =>
        [...activeStatusFilters].some((key) => emp[key] === true),
      );
    }

    return result;
  }, [employees, search, activeStatusFilters]);

  // Pipe scroll events up to parent (for hide/show bar)
  useEffect(() => {
    const el = listRef.current;
    if (!el || !onScroll) return;
    const handler = () => onScroll(el.scrollTop);
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [onScroll]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.cardList} ref={listRef}>
        {filteredEmployees.length > 0 ? (
          filteredEmployees.map((emp) => (
            <EmployeeCard key={emp.employeeId} emp={emp} />
          ))
        ) : (
          <p className={styles.empty}>Никого не нашли</p>
        )}
      </div>
    </div>
  );
};

export default AttendanceTableTelegram;
