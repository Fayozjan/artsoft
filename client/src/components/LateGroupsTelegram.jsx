import { useTranslation } from "react-i18next";

import { IconBuilding, IconMapPin, IconUsers } from "./tg/tgIcons";
import { toneStyle } from "../utils/attendanceTelegram";
import { formatMoney, hhmm } from "../utils/lateTelegram";

import styles from "./AttendanceGroupsTelegram.module.scss";

const GroupCard = ({ group, subtitle, onSelect, t }) => {
  const counters = [
    { key: "people", tone: "amber", value: group.people, label: t("lateTg.peopleShort") },
    { key: "average", tone: "purple", value: hhmm(group.average), label: t("average") },
    {
      key: "times",
      tone: "red",
      value: group.count + group.breakCount,
      label: t("lateTg.casesShort"),
    },
  ];

  if (group.money > 0) {
    counters.push({
      key: "money",
      tone: "teal",
      value: formatMoney(group.money),
      label: t("penaltyAmount"),
    });
  }

  return (
    <div className={styles.card}>
      <div
        role="button"
        tabIndex={0}
        className={`${styles.cardBody} ${styles.cardClickable}`}
        onClick={() => onSelect(group.select)}
        onKeyDown={(e) => e.key === "Enter" && onSelect(group.select)}
      >
        <span className={styles.top}>
          <span className={styles.icon}>
            {group.isBranch ? <IconMapPin /> : <IconBuilding />}
          </span>

          <span className={styles.titleBlock}>
            <span className={styles.title}>{group.name}</span>
            <span className={styles.subtitle}>
              <IconUsers />
              {subtitle ? `${subtitle} · ${group.people}` : group.people}
            </span>
          </span>

          <span className={styles.rate} style={toneStyle("amber")}>
            {hhmm(group.minutes + group.breakMinutes)}
          </span>
        </span>

        <span className={styles.bar} aria-hidden="true">
          <span
            className={styles.barSegment}
            style={{ ...toneStyle("amber"), flexGrow: 0, flexBasis: `${group.share}%` }}
          />
        </span>

        <ul className={styles.counters}>
          {counters.map((counter) => (
            <li key={counter.key} style={toneStyle(counter.tone)}>
              <b>{counter.value}</b>
              <span>{counter.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

// Карточки филиалов или отделов: сколько людей опоздало и на сколько в сумме.
// Тап по карточке выбирает группу — список сотрудников сужается до неё.
const LateGroupsTelegram = ({ groups = [], showBranchName = false, onSelect }) => {
  const { t } = useTranslation();

  if (groups.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>
          <IconBuilding />
        </span>
        <p>{t("lateTg.empty")}</p>
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {groups.map((group) => (
        <GroupCard
          key={group.key}
          group={group}
          subtitle={showBranchName && !group.isBranch ? group.branch : undefined}
          onSelect={onSelect}
          t={t}
        />
      ))}
    </div>
  );
};

export default LateGroupsTelegram;
