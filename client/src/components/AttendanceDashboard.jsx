import { useState } from "react";
import { useTranslation } from "react-i18next";
import AttendanceCard from "./AttendanceCard";
import Portal from "./Portal";
import AttendanceTableByStatus from "./AttendanceTableByStatus";

import styles from "./AttendanceDashboard.module.scss";

export const getVisibleCardIds = (showAll) => {
  const alwaysVisible = [
    "branches",
    "departments",
    "employees",
    "present",
    "absent",
    "late",
  ];

  const todayOnly = [
    "branches",
    "departments",
    "employees",
    "present",
    "absent",
    "late",
    "inside",
    "left",
  ];

  return showAll ? [...alwaysVisible, ...todayOnly] : alwaysVisible;
};

const icons = {
  branches: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="200"
      height="200"
      viewBox="0 0 24 24"
    >
      <path
        fill="none"
        stroke="#44444E"
        d="M14 24v-6.5a2 2 0 0 1 2-2v-8s-1.5-1-4-1s-4 1-4 1v8a2 2 0 0 1 2 2V24m-6.5 0v-6.5a2 2 0 0 0-2-2v-8s1.5-1 4-1m15 17.5v-6.5a2 2 0 0 1 2-2v-8s-1.5-1-4-1m-6.65-2s-1.6-1-1.6-2.25a1.747 1.747 0 1 1 3.496 0c0 1.25-1.596 2.25-1.596 2.25h-.3Zm-6.5 0s-1.6-1-1.6-2.25a1.747 1.747 0 1 1 3.496 0C7.246 3.5 5.65 4.5 5.65 4.5h-.3Zm13 0s-1.6-1-1.6-2.25a1.747 1.747 0 1 1 3.496 0c0 1.25-1.596 2.25-1.596 2.25h-.3Z"
      />
    </svg>
  ),
  employees: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="200"
      height="200"
      viewBox="0 0 24 24"
    >
      <path
        fill="none"
        stroke="#0046FF"
        d="M11.5 23.5c-1 0-1.75-1.5-1.75-1.5C9 20.5 9 18.5 9 17v-.5L4 14v-.25l1.495-7.225M8.5 13.75l1.003-4.845A2 2 0 0 0 7.544 6.5H6c-.17 0-.338.009-.505.025M.5 13l.6-2.603a5.029 5.029 0 0 1 4.395-3.872M6 17.5c-1 3-3 5-5.5 5m19.5 1c-.813 0-1.422-1.211-1.422-1.211c-.61-1.219-.61-2.844-.61-4.063v-.406l-4.124-2.031v-.203l1.214-5.87m2.442 5.87l.846-4.087a1.5 1.5 0 0 0-1.47-1.804H15.47c-.139 0-.276.008-.41.021m-3.933 5.26l.435-2.098a3.991 3.991 0 0 1 3.497-3.162M19.92 13c1.165.837 2.623 1.164 4.08 1.164m-8.53 4.469c-.6 1.801-1.645 3.159-2.97 3.745M8.85 4.5s-1.6-1-1.6-2.25C7.25 1.284 8.034.5 9 .5c.967 0 1.746.784 1.746 1.75c0 1.25-1.596 2.25-1.596 2.25h-.3Zm8.5 3s-1.6-1-1.6-2.25a1.746 1.746 0 1 1 3.495 0c0 1.25-1.595 2.25-1.595 2.25h-.3Z"
      />
    </svg>
  ),
  came: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="200"
      height="200"
      viewBox="0 0 24 24"
    >
      <path
        fill="none"
        stroke="#0A400C"
        d="M17 12H1m10.5-5c0 .577.665 1.562 1.228 2.294a7.494 7.494 0 0 0 1.745 1.662C15.2 11.445 16.2 12 16.99 12c-.79 0-1.79.556-2.517 1.044a7.494 7.494 0 0 0-1.745 1.662c-.563.732-1.228 1.717-1.228 2.294m-3-10V2.5h.329A46 46 0 0 0 21.897.605L22.25.5h.25v23h-.25l-.353-.105A45.998 45.998 0 0 0 8.829 21.5H8.5V17"
      />
    </svg>
  ),
  notCame: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="200"
      height="200"
      viewBox="0 0 24 24"
    >
      <path
        fill="none"
        stroke="#FF3F33"
        d="M5 8.5v-1a7 7 0 0 1 14 0a4.83 4.83 0 0 1-1.414 3.414l-2.414 2.414A4 4 0 0 0 14 16.157v.343h-4v-1.172c0-1.81.72-3.547 2-4.828l1.293-1.293A2.414 2.414 0 0 0 14 7.5a2 2 0 1 0-4 0v1H5Zm7 11a2 2 0 1 1 0 4a2 2 0 0 1 0-4Z"
      />
    </svg>
  ),
  late: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="200"
      height="200"
      viewBox="0 0 24 24"
    >
      <path
        fill="none"
        stroke="#FF9D00"
        d="M12 19.5a2 2 0 1 1 0 4a2 2 0 0 1 0-4Zm2-3h-4v-.129A62 62 0 0 0 8.033.88L8 .75V.5h8v.25l-.033.129A61.999 61.999 0 0 0 14 16.37v.129Z"
      />
    </svg>
  ),
  inside: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="200"
      height="200"
      viewBox="0 0 24 24"
    >
      <path
        fill="none"
        stroke="#2563eb"
        d="M12 23.92a9.04 9.04 0 0 0-2.96-6.61l-2.567-2.334A8.365 8.365 0 0 1 3.75 8.799C3.75 4.242 7.444.5 12 .5s8.25 3.741 8.25 8.298c0 2.343-.989 4.6-2.723 6.177l-2.568 2.334a9.041 9.041 0 0 0-2.96 6.61Zm0 0V24v-.057M12 11.5a2.5 2.5 0 1 1 0-5a2.5 2.5 0 0 1 0 5Z"
      />
    </svg>
  ),
  left: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="200"
      height="200"
      viewBox="0 0 24 24"
    >
      <path
        fill="none"
        stroke="#7c3aed"
        d="M24 12H8m10.5-5c0 .577.665 1.562 1.228 2.294a7.494 7.494 0 0 0 1.745 1.662C22.2 11.445 23.2 12 23.99 12c-.79 0-1.79.556-2.517 1.044a7.494 7.494 0 0 0-1.745 1.662c-.563.732-1.228 1.717-1.228 2.294m-4-10V2.5h-.329A46 46 0 0 1 1.103.605L.75.5H.5v23h.25l.353-.105A45.998 45.998 0 0 1 14.171 21.5h.329V17"
      />
    </svg>
  ),
  percent: (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="200"
      height="200"
      viewBox="0 0 24 24"
      fill="#500073"
    >
      <g fill="none" stroke="#500073">
        <path d="M18 6L6 18" />
        <circle cx="7" cy="8" r="3.5" />
        <circle cx="17" cy="16" r="3.5" />
      </g>
    </svg>
  ),
};

export const AttendanceDashboard = ({
  data,
  showAllCards = true,
  viewMode,
}) => {
  const { t } = useTranslation();
  const [modalData, setModalData] = useState(null);
  const visibleCardIds = getVisibleCardIds(showAllCards);

  const total = data?.employees?.length || 0;
  const presentCount = data?.present?.length || 0;

  const pct = (num, base) =>
    base > 0 ? `${((num / base) * 100).toFixed(1)}%` : null;

  const attendanceCards = [
    viewMode !== "branch" && {
      id: "branches",
      title: t("totalBranchesLabel"),
      value: data?.branches?.length || 0,
      data: data?.branches,
      icon: icons.branches,
      color: "#44444e",
    },
    {
      id: "departments",
      title: t("totalDepartmentsLabel"),
      value: data?.departments?.length || 0,
      data: data?.departments,
      icon: icons.branches,
      color: "#44444e",
    },
    {
      id: "employees",
      title: t("dashboard.totalEmployees"),
      value: total,
      data: data?.employees,
      icon: icons.employees,
      color: "#0046ff",
    },
    {
      id: "present",
      title: t("checkedIn"),
      value: presentCount,
      data: data?.present,
      icon: icons.came,
      color: "#16a34a",
      sub: pct(presentCount, total),
      progress: total > 0 ? (presentCount / total) * 100 : 0,
    },
    {
      id: "absent",
      title: t("notCheckedIn"),
      value: data?.absent?.length || 0,
      data: data?.absent,
      icon: icons.notCame,
      color: "#ef4444",
      sub: pct(data?.absent?.length || 0, total),
      progress: total > 0 ? ((data?.absent?.length || 0) / total) * 100 : 0,
    },
    {
      id: "late",
      title: t("lateGroup"),
      value: data?.late?.length || 0,
      data: data?.late,
      icon: icons.late,
      color: "#f59e0b",
      sub: pct(data?.late?.length || 0, presentCount),
      progress:
        presentCount > 0 ? ((data?.late?.length || 0) / presentCount) * 100 : 0,
    },
    {
      id: "inside",
      title: t("onSite"),
      value: data?.inside?.length || 0,
      data: data?.inside,
      icon: icons.inside,
      color: "#2563eb",
      sub: pct(data?.inside?.length || 0, presentCount),
      progress:
        presentCount > 0
          ? ((data?.inside?.length || 0) / presentCount) * 100
          : 0,
    },
    {
      id: "left",
      title: t("checkedOut"),
      value: data?.left?.length || 0,
      data: data?.left,
      icon: icons.left,
      color: "#7c3aed",
      sub: pct(data?.left?.length || 0, presentCount),
      progress:
        presentCount > 0 ? ((data?.left?.length || 0) / presentCount) * 100 : 0,
    },
  ];

  const cardsToDisplay = attendanceCards.filter((card) =>
    visibleCardIds.includes(card.id),
  );

  return (
    <div className={styles.cardWrapper}>
      {cardsToDisplay.map(({ id, title, color, progress, sub, ...props }) => (
        <AttendanceCard
          key={id}
          id={id}
          title={title}
          color={color}
          progress={progress}
          sub={sub}
          {...props}
          onClick={() => {
            if (id !== "latePercent") {
              setModalData({ type: id, title });
            }
          }}
        />
      ))}

      <Portal isOpen={!!modalData} onClose={() => setModalData(null)}>
        <AttendanceTableByStatus
          key={modalData?.type}
          data={data}
          modalType={modalData?.type}
          modalTitle={modalData?.title}
        />
      </Portal>
    </div>
  );
};
