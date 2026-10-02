import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import DownloadButton from "./DownloadButton";
import { Icons } from "../icons/icons";

import styles from "./AttendanceTable.module.scss";
import matrix from "./AttendancePeriodTable.module.scss";
import { downloadAttendancePeriodSheet } from "../utils/DocGenerator";

// Показатели дня: поле дневного среза + ключи полного и короткого названия.
// «По графику» идёт первым — это актуальное на день число сотрудников.
const METRICS = [
  {
    field: "scheduledEmployees",
    labelKey: "onScheduleCount",
    shortKey: "shortScheduled",
    tone: "toneScheduled",
  },
  {
    field: "present",
    labelKey: "checkedIn",
    shortKey: "shortCheckedIn",
    tone: "tonePresent",
  },
  {
    field: "absent",
    labelKey: "notCheckedIn",
    shortKey: "shortNotCheckedIn",
    tone: "toneAbsent",
  },
  {
    field: "late",
    labelKey: "lateGroup",
    shortKey: "shortLate",
    tone: "toneLate",
  },
  {
    field: "onTimeOff",
    labelKey: "onCompanyTimeOff",
    shortKey: "shortOnTimeOff",
    tone: "toneTimeOff",
  },
];

// Показателей в дне + колонка процента посещаемости
const DAY_COLUMNS = METRICS.length + 1;

// "2026-08-01" → "01.08"
const formatDayShort = (isoDay) => {
  const [, m, d] = String(isoDay || "").split("-");
  return d ? `${d}.${m}` : String(isoDay || "");
};

// "2026-08-01" → "01.08.2026"
const formatDay = (isoDay) => {
  const [y, m, d] = String(isoDay || "").split("-");
  return d ? `${d}.${m}.${y}` : String(isoDay || "");
};

const attendanceRate = (counts) =>
  counts?.scheduledEmployees > 0
    ? `${Math.round((counts.present / counts.scheduledEmployees) * 100)}%`
    : null;

// Табель за период: филиалы / отделы слева, дни периода — колонками справа,
// в каждом дне все показатели посещаемости за этот день.
const AttendancePeriodTable = ({ days = [], viewMode, period }) => {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState("");
  const [openBranches, setOpenBranches] = useState({});

  const byName = (a, b) =>
    a.name.localeCompare(b.name, "ru", { sensitivity: "base" });

  const weekdayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.language || "ru", {
        weekday: "short",
        timeZone: "UTC",
      }),
    [i18n.language],
  );

  const weekday = (isoDay) => {
    const [y, m, d] = String(isoDay || "")
      .split("-")
      .map(Number);
    if (!y || !m || !d) return "";
    return weekdayFormatter.format(new Date(Date.UTC(y, m - 1, d)));
  };

  // Разворачиваем дневные срезы в матрицу: строка — филиал / отдел,
  // колонка — день периода
  const rows = useMemo(() => {
    const branches = new Map();

    const ensure = (map, name) => {
      if (!map.has(name)) {
        map.set(name, { name, byDate: {}, departments: new Map() });
      }
      return map.get(name);
    };

    for (const day of days) {
      for (const branch of day.branches || []) {
        const branchRow = ensure(branches, branch.name || t("noBranch"));
        branchRow.byDate[day.date] = branch;

        for (const dept of branch.departments || []) {
          const deptRow = ensure(
            branchRow.departments,
            dept.name || t("noDepartment"),
          );
          deptRow.byDate[day.date] = dept;
        }
      }
    }

    return [...branches.values()]
      .map((branch) => ({
        ...branch,
        departments: [...branch.departments.values()].sort(byName),
      }))
      .sort(byName);
  }, [days, t]);

  // В режиме одного филиала верхний уровень не нужен — сразу отделы
  const topRows = useMemo(
    () =>
      viewMode === "branch"
        ? rows.flatMap((branch) => branch.departments)
        : rows,
    [rows, viewMode],
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return topRows;

    const hit = (value) => String(value || "").toLowerCase().includes(query);

    return topRows.filter(
      (row) =>
        hit(row.name) || (row.departments || []).some((d) => hit(d.name)),
    );
  }, [topRows, search]);

  const toggleBranch = (name) =>
    setOpenBranches((prev) => ({ ...prev, [name]: !prev[name] }));

  const renderDayCells = (counts, isDayOff) => (
    <>
      {METRICS.map((metric, i) => (
        <td
          key={metric.field}
          className={[
            matrix.metricCell,
            matrix[metric.tone],
            i === 0 ? matrix.groupStart : "",
            isDayOff ? matrix.dayOff : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {counts ? (
            counts[metric.field] || 0
          ) : (
            <span className={matrix.empty}>—</span>
          )}
        </td>
      ))}

      <td
        className={`${matrix.metricCell} ${matrix.rateCell} ${isDayOff ? matrix.dayOff : ""}`}
      >
        {attendanceRate(counts) ?? <span className={matrix.empty}>—</span>}
      </td>
    </>
  );

  const renderRow = (row, { isBranch }) => {
    const hasDepartments = row.departments?.length > 0;

    return (
      <tr
        className={[
          isBranch ? matrix.branchRow : matrix.deptRow,
          hasDepartments ? matrix.clickableRow : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={hasDepartments ? () => toggleBranch(row.name) : undefined}
      >
        <td className={matrix.nameCell}>
          <span className={matrix.nameContent}>
            {hasDepartments && (
              <span
                className={`${matrix.toggleIcon} ${openBranches[row.name] ? matrix.toggleIconOpen : ""}`}
              >
                {Icons.chevronDown}
              </span>
            )}
            {row.name}
          </span>
        </td>

        {days.map((day) => (
          <Fragment key={day.date}>
            {renderDayCells(row.byDate[day.date], !day.scheduledEmployees)}
          </Fragment>
        ))}
      </tr>
    );
  };

  const renderBody = () => {
    if (!days.length || !filteredRows.length) {
      return (
        <tr>
          <td colSpan={1 + days.length * DAY_COLUMNS}>{t("noData")}</td>
        </tr>
      );
    }

    return filteredRows.map((row) => (
      <Fragment key={row.name}>
        {/* Верхний уровень — филиал, а в режиме одного филиала сразу отдел */}
        {renderRow(row, { isBranch: true })}

        {openBranches[row.name] &&
          (row.departments || []).map((dept) => (
            <Fragment key={`${row.name}|${dept.name}`}>
              {renderRow(dept, { isBranch: false })}
            </Fragment>
          ))}
      </Fragment>
    ));
  };

  const exportRows = () =>
    filteredRows.flatMap((row) =>
      viewMode === "branch"
        ? [row]
        : [row, ...(row.departments || []).map((d) => ({ ...d, isDept: true }))],
    );

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={matrix.titleBlock}>
          <h4 className={matrix.title}>
            {t("attendanceTimesheet")}
            {period?.from && (
              <span className={matrix.titlePeriod}>
                {formatDay(period.from)} — {formatDay(period.to)}
              </span>
            )}
          </h4>

          <div className={matrix.legend}>
            {METRICS.map((metric) => (
              <span key={metric.field} className={matrix.legendItem}>
                <b className={`${matrix.legendMark} ${matrix[metric.tone]}`}>
                  {t(metric.shortKey)}
                </b>
                {t(metric.labelKey)}
              </span>
            ))}
            <span className={matrix.legendItem}>
              <b className={matrix.legendMark}>%</b>
              {t("attendance")}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div className={styles.searchInput}>
            {Icons.search}
            <input
              type="text"
              placeholder={t("search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <span
                className={styles.clearBtn}
                onClick={() => setSearch("")}
                style={{ display: "flex", cursor: "pointer" }}
              >
                {Icons.clear}
              </span>
            )}
          </div>

          {days.length > 0 && (
            <DownloadButton
              text={t("save")}
              onClick={() =>
                downloadAttendancePeriodSheet({
                  rows: exportRows(),
                  days,
                  metrics: METRICS.map((m) => ({
                    field: m.field,
                    label: t(m.labelKey),
                    short: t(m.shortKey),
                  })),
                  period,
                })
              }
            />
          )}
        </div>
      </div>

      <div className={matrix.matrixContainer}>
        <table className={matrix.matrix}>
          <thead>
            <tr>
              <th rowSpan={2} className={matrix.nameCell}>
                {viewMode === "branch" ? t("department") : t("branch")}
              </th>

              {days.map((day) => (
                <th
                  key={day.date}
                  colSpan={DAY_COLUMNS}
                  className={`${matrix.groupStart} ${!day.scheduledEmployees ? matrix.dayOff : ""}`}
                >
                  <span className={matrix.dayHeader}>
                    {formatDayShort(day.date)}
                    <span className={matrix.dayWeekday}>
                      {weekday(day.date)}
                    </span>
                  </span>
                </th>
              ))}
            </tr>

            <tr>
              {days.map((day) => (
                <Fragment key={day.date}>
                  {METRICS.map((metric, i) => (
                    <th
                      key={`${day.date}-${metric.field}`}
                      title={t(metric.labelKey)}
                      className={[
                        matrix.metricCell,
                        matrix[metric.tone],
                        i === 0 ? matrix.groupStart : "",
                        !day.scheduledEmployees ? matrix.dayOff : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {t(metric.shortKey)}
                    </th>
                  ))}

                  <th
                    title={t("attendance")}
                    className={[
                      matrix.metricCell,
                      matrix.rateCell,
                      !day.scheduledEmployees ? matrix.dayOff : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    %
                  </th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>{renderBody()}</tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendancePeriodTable;
