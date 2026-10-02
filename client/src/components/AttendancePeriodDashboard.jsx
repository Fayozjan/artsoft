import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import AttendanceCard from "./AttendanceCard";
import { icons } from "./AttendanceDashboard";

import styles from "./AttendanceDashboard.module.scss";

// Итоги за период: мгновенных статусов (на месте / ушёл) нет,
// показываем состав, календарь периода и накопленные дни.
const AttendancePeriodDashboard = ({ data, rows = [], viewMode }) => {
  const { t } = useTranslation();

  // workedDays нужен как база процента опозданий, отдельной карточкой не идёт
  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, branch) => {
          acc.workedDays += branch.workedDays;
          acc.lateDays += branch.lateDays;
          return acc;
        },
        { workedDays: 0, lateDays: 0 },
      ),
    [rows],
  );

  // Рабочий день периода — тот, где хоть кто-то стоит в графике
  const calendar = useMemo(() => {
    const days = data?.days || [];
    const workingDays = days.filter((day) => day.scheduledEmployees > 0).length;
    return { workingDays, dayOffDays: days.length - workingDays };
  }, [data]);

  const pct = (num, base) =>
    base > 0 ? `${((num / base) * 100).toFixed(1)}%` : null;

  const cards = [
    viewMode !== "branch" && {
      id: "branches",
      title: t("totalBranchesLabel"),
      value: data?.branches?.length || 0,
      icon: icons.branches,
      color: "#44444e",
    },
    {
      id: "departments",
      title: t("totalDepartmentsLabel"),
      value: data?.departments?.length || 0,
      icon: icons.branches,
      color: "#44444e",
    },
    {
      id: "employees",
      title: t("dashboard.totalEmployees"),
      value: data?.employees?.length || 0,
      icon: icons.employees,
      color: "#0046ff",
    },
    {
      id: "workingDays",
      title: t("scheduledWorkDays"),
      value: calendar.workingDays,
      icon: icons.percent,
      color: "#500073",
    },
    {
      id: "dayOffDays",
      title: t("dayOffDaysLabel"),
      value: calendar.dayOffDays,
      icon: icons.left,
      color: "#7c3aed",
    },
    {
      id: "lateDays",
      title: t("lateCount"),
      value: totals.lateDays,
      icon: icons.late,
      color: "#f59e0b",
      sub: pct(totals.lateDays, totals.workedDays),
      progress:
        totals.workedDays > 0 ? (totals.lateDays / totals.workedDays) * 100 : 0,
    },
  ].filter(Boolean);

  return (
    <div className={styles.cardWrapper}>
      {cards.map(({ id, title, color, progress, sub, ...props }) => (
        <AttendanceCard
          key={id}
          id={id}
          title={title}
          color={color}
          progress={progress}
          sub={sub}
          {...props}
        />
      ))}
    </div>
  );
};

export default AttendancePeriodDashboard;
