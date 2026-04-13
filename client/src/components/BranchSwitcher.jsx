// BranchSwitcher.jsx
import { useState, useRef, useEffect } from "react";
import { Icons } from "../icons/icons";
import styles from "./BranchSwitcher.module.scss";

export const BranchSwitcher = ({
  branches,
  activeBranch,
  activeBranchId,
  onSelect,
  isOpen,
}) => {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef(null);

  // Закрыть при клике снаружи
  useEffect(() => {
    const handler = (e) => {
      if (!ref.current?.contains(e.target)) setExpanded(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!isOpen) {
    // Mini режим — иконка + popup при hover
    return (
      <div className={styles.branchMini}>
        <div className={styles.branchMiniIcon} title={activeBranch?.name}>
          {Icons.branch} {/* иконка здания/офиса */}
        </div>
        <div className={styles.branchMiniPopup}>
          {branches.map((b) => (
            <button
              key={b.id}
              className={`${styles.branchMiniItem} ${b.id === activeBranchId ? styles.branchActive : ""}`}
              onClick={() => onSelect(b.id)}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.branchSwitcher} ref={ref}>
      <button
        className={styles.branchCurrent}
        onClick={() => setExpanded((p) => !p)}
      >
        <span className={styles.branchName}>{activeBranch?.name ?? "—"}</span>
        <span className={`${styles.branchChevron}`}>{Icons.selectArrows}</span>
      </button>

      {expanded && (
        <ul className={styles.branchList}>
          {branches.map((b) => (
            <li key={b.id}>
              <button
                className={`${styles.branchItem} ${b.id === activeBranchId ? styles.branchActive : ""}`}
                onClick={() => {
                  onSelect(b.id);
                  setExpanded(false);
                }}
              >
                {b.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
