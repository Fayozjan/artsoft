import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import SortArrow from "./SortArrow";
import styles from "./StaffingPicker.module.scss";

const StaffingPicker = ({ allPositions = [], staffing = [], onChange }) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef(null);
  const [sortField, setSortField] = useState(null);
  const [sortOrder, setSortOrder] = useState("asc");

  useEffect(() => {
    const handleClick = (e) => {
      if (!containerRef.current?.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const staffingMap = new Map(staffing.map((s) => [s.position_id, s]));

  const filtered = allPositions
    .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aSelected = staffingMap.has(a.id);
      const bSelected = staffingMap.has(b.id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return a.name.localeCompare(b.name);
    });

  const setDropHeadcount = (pos, val) => {
    const count = Math.max(0, Number(val) || 0);
    if (count === 0) {
      onChange(staffing.filter((s) => s.position_id !== pos.id));
    } else if (staffingMap.has(pos.id)) {
      onChange(staffing.map((s) => s.position_id === pos.id ? { ...s, headcount: count } : s));
    } else {
      onChange([...staffing, { position_id: pos.id, position_name: pos.name, headcount: count }]);
    }
  };

  const togglePosition = (pos) => {
    if (staffingMap.has(pos.id)) return;
    onChange([...staffing, { position_id: pos.id, position_name: pos.name, headcount: 1 }]);
  };

  const removeStaffing = (position_id) => {
    onChange(staffing.filter((s) => s.position_id !== position_id));
  };

  const updateHeadcount = (position_id, val) => {
    const count = Math.max(1, Number(val) || 1);
    onChange(staffing.map((s) => s.position_id === position_id ? { ...s, headcount: count } : s));
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedStaffing = sortField
    ? [...staffing].sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
        }
        return sortOrder === "asc"
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      })
    : staffing;

  return (
    <div className={styles.picker}>
      <label className={styles.label}>{t("staffingPositionsLabel")}</label>

      {staffing.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <th onClick={() => handleSort("position_name")}>
                <span className={styles.headerContent}>
                  {t("position")}
                  <SortArrow active={sortField === "position_name"} order={sortOrder} />
                </span>
              </th>
              <th onClick={() => handleSort("headcount")}>
                <span className={styles.headerContent}>
                  {t("headcount")}
                  <SortArrow active={sortField === "headcount"} order={sortOrder} />
                </span>
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sortedStaffing.map((s) => (
              <tr key={s.position_id}>
                <td>{s.position_name}</td>
                <td>
                  <input
                    type="number"
                    min={1}
                    value={s.headcount}
                    onChange={(e) => updateHeadcount(s.position_id, e.target.value)}
                    className={styles.countInput}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td>
                  <button type="button" onClick={() => removeStaffing(s.position_id)} className={styles.removeBtn}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className={styles.searchWrap} ref={containerRef}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          placeholder={t("searchPositionPlaceholder")}
          className={styles.searchInput}
        />
        {showDropdown && (
          <div className={styles.dropdown}>
            {filtered.length === 0 ? (
              <div className={styles.empty}>{t("nothingFound")}</div>
            ) : (
              filtered.map((pos) => {
                const selected = staffingMap.get(pos.id);
                return (
                  <div
                    key={pos.id}
                    className={`${styles.dropItem} ${selected ? styles.selected : ""}`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => togglePosition(pos)}
                  >
                    <span className={styles.checkmark}>{selected ? "✓" : ""}</span>
                    <span className={styles.posName}>{pos.name}</span>
                    <input
                      type="number"
                      min={0}
                      value={selected ? selected.headcount : 0}
                      onChange={(e) => setDropHeadcount(pos, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      className={styles.dropCount}
                    />
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffingPicker;
