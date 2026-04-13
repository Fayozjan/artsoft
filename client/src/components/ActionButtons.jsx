import { useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { Icons } from "../icons/icons";

// ─── Tooltip через портал ────────────────────────────────────────────────
const Tooltip = ({ label, visible, targetRef }) => {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (visible && targetRef?.current) {
      const rect = targetRef.current.getBoundingClientRect();
      setPos({
        top: rect.top - 28,
        left: rect.left + rect.width / 2,
      });
    }
  }, [visible, targetRef]);

  if (!visible) return null;

  return createPortal(
    <span
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        transform: "translateX(-50%)",
        background: "#18181b",
        color: "#fafafa",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: "0.02em",
        padding: "4px 9px",
        borderRadius: 6,
        whiteSpace: "nowrap",
        pointerEvents: "none",
        zIndex: 9999,
        boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
        fontFamily: "inherit",
      }}
    >
      {label}
      <span
        style={{
          position: "absolute",
          top: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          borderTop: "5px solid #18181b",
        }}
      />
    </span>,
    document.body,
  );
};

// ─── Варианты кнопок ────────────────────────────────────────────────────
const VARIANTS = {
  download: {
    color: "#6c7785",
    hoverBg: "#eff6ff",
    hoverColor: "#2563eb",
    activeBg: "#dbeafe",
  },
  edit: {
    color: "#6c7785",
    hoverBg: "#f0fdf4",
    hoverColor: "#16a34a",
    activeBg: "#dcfce7",
  },
  delete: {
    color: "#6c7785",
    hoverBg: "#fef2f2",
    hoverColor: "#dc2626",
    activeBg: "#fee2e2",
  },
};

// ─── ActionButton ───────────────────────────────────────────────────────
const ActionButton = ({ onClick, icon: Icon, label, variant }) => {
  const [hovered, setHovered] = useState(false);
  const [active, setActive] = useState(false);
  const ref = useRef(null);
  const v = VARIANTS[variant];

  return (
    <button
      ref={ref}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setActive(false);
      }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      aria-label={label}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        border: "none",
        borderRadius: 8,
        background: active ? v.activeBg : hovered ? v.hoverBg : "transparent",
        color: hovered ? v.hoverColor : v.color,
        cursor: "pointer",
        transition:
          "background 0.15s ease, color 0.15s ease, transform 0.1s ease",
        transform: active ? "scale(0.9)" : "scale(1)",
        outline: "none",
        padding: 0,
        flexShrink: 0,
      }}
    >
      {Icon}
      <Tooltip label={label} visible={hovered && !active} targetRef={ref} />
    </button>
  );
};

// ─── ActionCell ─────────────────────────────────────────────────────────
export const ActionCell = ({
  item,
  canEdit,
  canDelete,
  onDownload,
  onEdit,
  onDelete,
}) => {
  if (!canEdit && !canDelete) return null;

  return (
    <td style={{ textAlign: "center", verticalAlign: "middle" }}>
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0,
        }}
      >
        {onDownload && (
          <ActionButton
            onClick={() => onDownload(item)}
            icon={Icons.save}
            label="Скачать"
            variant="download"
          />
        )}

        {canEdit && (
          <ActionButton
            onClick={() => onEdit(item.id)}
            icon={Icons.edit}
            label="Редактировать"
            variant="edit"
          />
        )}
        {canDelete && (
          <ActionButton
            onClick={() => onDelete(item.id)}
            icon={Icons.delete}
            label="Удалить"
            variant="delete"
          />
        )}
      </div>
    </td>
  );
};
