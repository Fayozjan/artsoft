import { Icons } from "../icons/icons";

import styles from "./SegmentedGroup.module.scss";

const DotIcon = (
  <svg viewBox="0 0 24 24" width="14" height="14">
    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15" />
    <circle cx="12" cy="12" r="4" fill="currentColor" />
  </svg>
);

const CheckIcon = (
  <svg viewBox="0 0 24 24" width="14" height="14">
    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15" />
    <path
      d="M7 12l3 3 7-7"
      stroke="currentColor"
      strokeWidth="2.2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CrossIcon = (
  <svg viewBox="0 0 24 24" width="14" height="14">
    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15" />
    <path
      d="M8 8l8 8M16 8l-8 8"
      stroke="currentColor"
      strokeWidth="2.2"
      fill="none"
      strokeLinecap="round"
    />
  </svg>
);

export const segmentIcons = {
  all: DotIcon,
  yes: CheckIcon,
  no: CrossIcon,
};

// Статус: Все / Включён / Выключен
export const statusSegments = (t) => [
  { value: "", label: t("all"), color: "#6b7280", icon: DotIcon },
  { value: "true", label: t("true"), color: "#16a34a", icon: CheckIcon },
  { value: "false", label: t("false"), color: "#dc2626", icon: CrossIcon },
];

// Сложность операции: Все / Простая / Средняя / Сложная
export const complexitySegments = (t) => [
  { value: "", label: t("all"), color: "#6b7280", icon: DotIcon },
  { value: "simple", label: t("complexitySimple"), color: "#16a34a" },
  { value: "medium", label: t("complexityMedium"), color: "#f59e0b" },
  { value: "hard", label: t("complexityHard"), color: "#dc2626" },
];

// Единица измерения: Все / Кг / Шт / М
export const unitSegments = (t) => [
  { value: "", label: t("all"), color: "#6b7280", icon: DotIcon },
  { value: "kg", label: t("unitKg"), color: "#6366f1" },
  { value: "pcs", label: t("unitPcs"), color: "#6366f1" },
  { value: "m", label: t("unitM"), color: "#6366f1" },
];

// Направление: Все / Вход / Выход
export const directionSegments = (t) => [
  { value: "", label: t("all"), color: "#6b7280", icon: Icons.dot },
  {
    value: "entry",
    label: t("entry"),
    color: "#16a34a",
    icon: Icons.directionIn,
  },
  {
    value: "exit",
    label: t("exit"),
    color: "#dc2626",
    icon: Icons.directionOut,
  },
];

const SegmentedGroup = ({ label, options, value, onChange }) => {
  const current = value ?? "";
  const activeIdx = options.findIndex((o) => o.value === current);

  return (
    <div className={styles.segmentedGroup}>
      {label && <span className={styles.segmentedLabel}>{label}</span>}
      <div className={styles.segmentedTrack}>
        {activeIdx >= 0 && (
          <div
            className={styles.segmentedSlider}
            style={{
              width: `calc(${100 / options.length}% - 4px)`,
              left: `calc(${activeIdx * (100 / options.length)}% + 2px)`,
            }}
          />
        )}
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`${styles.segmentedBtn} ${current === opt.value ? styles.segmentedBtnActive : ""}`}
            style={{ color: current === opt.value ? opt.color : undefined }}
            onClick={() => onChange(opt.value)}
          >
            {opt.icon && (
              <span
                className={styles.segmentedIcon}
                style={{ color: opt.color }}
              >
                {opt.icon}
              </span>
            )}
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SegmentedGroup;
