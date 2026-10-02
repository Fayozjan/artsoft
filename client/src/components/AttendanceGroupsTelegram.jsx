import { useState } from "react";
import { useTranslation } from "react-i18next";

import { IconBuilding, IconChevronDown, IconMapPin, IconUsers } from "./tg/tgIcons";
import { toneStyle } from "../utils/attendanceTelegram";

import styles from "./AttendanceGroupsTelegram.module.scss";

const StackBar = ({ segments, className }) => {
  const visible = segments.filter((seg) => seg.value > 0);

  return (
    <span className={`${styles.bar} ${className || ""}`} aria-hidden="true">
      {visible.map((seg) => (
        <span
          key={seg.tone}
          className={styles.barSegment}
          style={{ ...toneStyle(seg.tone), flexGrow: seg.value }}
        />
      ))}
    </span>
  );
};

const RateText = ({ rate }) => (rate == null ? "—" : `${rate}%`);

const DepartmentRow = ({ dept, onSelect }) => {
  const content = (
    <>
      <span className={styles.deptName}>{dept.name}</span>
      <StackBar segments={dept.bar} className={styles.deptBar} />
      <span className={styles.deptCount}>{dept.count}</span>
      <span className={styles.deptRate}>
        <RateText rate={dept.rate} />
      </span>
    </>
  );

  if (!onSelect) return <div className={styles.deptRow}>{content}</div>;

  return (
    <button
      type="button"
      className={`${styles.deptRow} ${styles.deptRowButton}`}
      onClick={() => onSelect(dept.select)}
    >
      {content}
    </button>
  );
};

const GroupCard = ({ group, onSelect, t }) => {
  const [open, setOpen] = useState(false);
  const hasChildren = group.departments?.length > 0;
  const clickable = Boolean(onSelect && group.select);

  return (
    <div className={styles.card}>
      <div
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        className={`${styles.cardBody} ${clickable ? styles.cardClickable : ""}`}
        onClick={clickable ? () => onSelect(group.select) : undefined}
        onKeyDown={
          clickable ? (e) => e.key === "Enter" && onSelect(group.select) : undefined
        }
      >
        <span className={styles.top}>
          <span className={styles.icon}>
            {group.isBranch ? <IconMapPin /> : <IconBuilding />}
          </span>

          <span className={styles.titleBlock}>
            <span className={styles.title}>{group.name}</span>
            <span className={styles.subtitle}>
              <IconUsers />
              {group.subtitle ? `${group.subtitle} · ${group.total}` : group.total}
            </span>
          </span>

          <span className={styles.rate} style={toneStyle("green")}>
            <RateText rate={group.rate} />
          </span>
        </span>

        <StackBar segments={group.bar} />

        <ul className={styles.counters}>
          {group.counters.map((counter) => (
            <li key={counter.key} style={toneStyle(counter.tone)}>
              <b>{counter.value}</b>
              <span>{counter.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {hasChildren && (
        <>
          <button
            type="button"
            className={`${styles.toggle} ${open ? styles.toggleOpen : ""}`}
            aria-expanded={open}
            onClick={() => setOpen((prev) => !prev)}
          >
            <span>{open ? t("hide") : t("showByDept")}</span>
            <IconChevronDown />
          </button>

          {open && (
            <div className={styles.departments}>
              {group.departments.map((dept) => (
                <DepartmentRow key={dept.key} dept={dept} onSelect={onSelect} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// Карточки филиалов или отделов: доля явки, полоса долей, счётчики.
// Если передан onSelect — тап по карточке выбирает эту группу (фильтр списка сотрудников).
const AttendanceGroupsTelegram = ({ groups = [], onSelect }) => {
  const { t } = useTranslation();

  if (groups.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>
          <IconBuilding />
        </span>
        <p>{t("noData")}</p>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {groups.map((group) => (
        <GroupCard key={group.key} group={group} onSelect={onSelect} t={t} />
      ))}
    </div>
  );
};

export default AttendanceGroupsTelegram;
