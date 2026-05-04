import { useEffect, useMemo, useState } from "react";
import styles from "./MorePageTelegram.module.scss";
import { getUserMenu } from "../api";
import { useOpenEmployeesPage } from "../hooks/useOpenEmployeesPage";
import { t } from "i18next";
import { useOpenFacePassesPage } from "../hooks/useOpenFacePassesPage";
import { useOpenVehiclePassesPage } from "../hooks/useOpenVehiclePassesPage";
import { useOpenAttendancePage } from "../hooks/useOpenAttendancePage";

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconEmployees = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <circle cx="8" cy="8" r="3" />
    <circle cx="16" cy="8" r="3" />
    <path d="M2 20c0-3.3 2.7-6 6-6h8c3.3 0 6 2.7 6 6" />
  </svg>
);

const IconAttendance = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const IconFacePasses = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M9 3H5a2 2 0 0 0-2 2v4" />
    <path d="M15 3h4a2 2 0 0 1 2 2v4" />
    <path d="M9 21H5a2 2 0 0 1-2-2v-4" />
    <path d="M15 21h4a2 2 0 0 0 2-2v-4" />
    <circle cx="12" cy="10" r="3" />
    <path d="M9 16c0-1.7 1.3-3 3-3s3 1.3 3 3" />
  </svg>
);

const IconVehiclePasses = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <rect x="2" y="8" width="20" height="10" rx="2" />
    <path d="M5 8l2-4h10l2 4" />
    <circle cx="7" cy="15" r="1.5" />
    <circle cx="17" cy="15" r="1.5" />
  </svg>
);

const IconChevron = () => (
  <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
    <path
      d="M1 1l5 5-5 5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const denyAll = { view: false, add: false, update: false, delete: false };

function findItem(navData, path) {
  for (const item of navData) {
    if (item.path === path) return item;
    const child = item.children?.find((c) => c.path === path);
    if (child) return child;
  }
  return null;
}

function buildMenuItems(navData) {
  const employees = findItem(navData, "/employees");
  const attendance = findItem(navData, "/attendance");
  const facePasses = findItem(navData, "/face-passes");
  const vehiclePasses = findItem(navData, "/vehicle-passes");

  return [
    {
      key: "employees",
      title: "employees",
      sub: "Staff directory",
      path: "/employees",
      iconClass: styles.iconBlue,
      icon: <IconEmployees />,
      permission: employees?.permissions ?? denyAll,
    },
    {
      key: "attendance",
      title: "attendance",
      sub: "Employee attendance",
      path: "/attendance",
      iconClass: styles.iconGreen,
      icon: <IconAttendance />,
      permission: attendance?.permissions ?? denyAll,
    },
    {
      key: "face-passes",
      title: "face-passes",
      sub: "Biometric access records",
      path: "/face-passes",
      iconClass: styles.iconPurple,
      icon: <IconFacePasses />,
      permission: facePasses?.permissions ?? denyAll,
    },
    {
      key: "vehicle-passes",
      title: "vehicle-passes",
      sub: "Gate & parking access",
      path: "/vehicle-passes",
      iconClass: styles.iconAmber,
      icon: <IconVehiclePasses />,
      permission: vehiclePasses?.permissions ?? denyAll,
    },
  ];
}

// ─── ListItem ─────────────────────────────────────────────────────────────────

function ListItem({ item, onPress }) {
  return (
    <div
      className={styles.listItem}
      role="button"
      tabIndex={0}
      onClick={() => onPress(item.path)}
      onKeyDown={(e) => e.key === "Enter" && onPress(item.path)}
    >
      <div className={`${styles.itemIcon} ${item.iconClass}`}>{item.icon}</div>

      <div className={styles.itemBody}>
        <p className={styles.itemTitle}>{t(item.title)}</p>
        <p className={styles.itemSub}>{t(item.sub)}</p>
      </div>

      <div className={styles.itemChevron}>
        <IconChevron />
      </div>
    </div>
  );
}

// ─── MorePage ─────────────────────────────────────────────────────────────────

function MorePageTelegram() {
  const [menuData, setMenuData] = useState([]);
  const openEmployeesPage = useOpenEmployeesPage();
  const openAttendancePage = useOpenAttendancePage();
  const openFacePassesPage = useOpenFacePassesPage();
  const openVehiclePassesPage = useOpenVehiclePassesPage();

  const handlers = {
    employees: openEmployeesPage,
    attendance: openAttendancePage,
    "face-passes": openFacePassesPage,
    "vehicle-passes": openVehiclePassesPage,
  };

  useEffect(() => {
    const fetchUserMenu = async () => {
      try {
        const res = await getUserMenu();
        setMenuData(res);
      } catch (error) {
        console.error("Ошибка получения меню:", error);
      }
    };
    fetchUserMenu();
  }, []);

  const items = useMemo(() => buildMenuItems(menuData), [menuData]);
  const visibleItems = items.filter((i) => i.permission.view);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.headerTitle}>{t("more")}</h1>
      </div>

      <div className={styles.main}>
        {visibleItems.length === 0 ? (
          <p className={styles.empty}>{t("noAccessibleSections")}</p>
        ) : (
          <div className={styles.cardList}>
            <div className={styles.list}>
              {visibleItems.map((item) => (
                <ListItem
                  key={item.key}
                  item={item}
                  onPress={handlers[item.key]}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MorePageTelegram;
