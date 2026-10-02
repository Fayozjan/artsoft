import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { getUserMenu } from "../api";
import { getMenuIcon } from "../icons/menuIcons";
import Loading from "../components/LoadingTelegram";
import { useAuthStore } from "../stores/authStore";
import { useScreenStack, useBackHandler } from "../context/ScreenStackContext";
import { FINANCE_SCREENS } from "./FinancePageTelegram";
import { useOpenBranchesPage } from "../hooks/useOpenBranchesPage";
import { useOpenDepartmentsPage } from "../hooks/useOpenDepartmentsPage";
import { useOpenEmployeesPage } from "../hooks/useOpenEmployeesPage";
import { useOpenFacePassesPage } from "../hooks/useOpenFacePassesPage";
import { useOpenVehiclePassesPage } from "../hooks/useOpenVehiclePassesPage";
import { useOpenAttendancePage } from "../hooks/useOpenAttendancePage";
import { useOpenLateEmployeesPage } from "../hooks/useOpenLateEmployeesPage";
import { useOpenBatchReceiptsPage } from "../hooks/useOpenBatchReceiptsPage";
import { useOpenWorkAcceptancePage } from "../hooks/useOpenWorkAcceptancePage";
import { useOpenOperationsPage } from "../hooks/useOpenOperationsPage";
import { useOpenUsersPage } from "../hooks/useOpenUsersPage";
import { useOpenTimesheetPage } from "../hooks/useOpenTimesheetPage";
import { useOpenTimeOffPage } from "../hooks/useOpenTimeOffPage";
import { useOpenWorkSchedulesPage } from "../hooks/useOpenWorkSchedulesPage";
import { useOpenPositionsPage } from "../hooks/useOpenPositionsPage";
import { useOpenAssetAssignmentsPage } from "../hooks/useOpenAssetAssignmentsPage";
import { useOpenProductionReportPage } from "../hooks/useOpenProductionReportPage";

import styles from "./MenuPageTelegram.module.scss";

// Пункты меню, у которых есть страница в telegramRoutes (путь без /tg).
// Home и tasks — вкладки нижней панели, поэтому в списке их нет.
// salary-settings / payroll / salary-payouts тоже нет: это подэкраны finance.
// Новый пункт меню с маршрутом в telegramRoutes нужно добавить и сюда.
const TG_MENU_PATHS = new Set([
  "/finance",
  "/branches",
  "/departments",
  "/staffing",
  "/employees",
  "/employment-orders",
  "/face-passes",
  "/attendance",
  "/late-employees",
  "/timesheet",
  "/work-schedules",
  "/time-off",
  "/production-calendar",
  "/positions",
  "/asset-assignments",
  "/users",
  "/telegram-bots",
  "/audit-logs",
  "/cron-tasks",
  "/doors",
  "/face-devices",
  "/vehicle-passes",
  "/gates",
  "/vehicle-cameras",
  "/canteen-allowances",
  "/canteen-display",
  "/canteen-report",
  "/operations",
  "/batch-receipts",
  "/work-acceptance",
  "/production-report",
]);

// Цвет значка — по разделу, чтобы пункты одного раздела выглядели одинаково.
const TONES = {
  hr: "iconBlue",
  finance: "iconGreen",
  "vehicle-passes": "iconTeal",
  canteen: "iconAmber",
  production: "iconPurple",
  settings: "iconGray",
};
const FALLBACK_TONES = ["iconBlue", "iconGreen", "iconPurple", "iconAmber"];

const bySortOrder = (a, b) => a.sort_order - b.sort_order;

// Пункт открывается, если у него есть страница/подэкран в TG-версии.
// Раздел без view-права, но с доступными подпунктами тоже отдаётся сервером.
const isOpenable = (item) =>
  (TG_MENU_PATHS.has(item.path) || item.name in FINANCE_SCREENS) &&
  (item.permissions?.view ||
    item.children?.some((child) => child.permissions?.view));

// Каждый верхний пункт дерева — отдельный раздел со своим заголовком, в порядке
// sort_order. Есть подпункты (hr, finance, canteen, ...) — они и есть строки
// раздела; нет (vehicle-passes) — в разделе одна строка с самой страницей.
// Если подпунктов нет, а страница раздела есть — или раздел включён в личный
// режим (finance показывает свои данные) — строка ведёт на саму страницу.
function buildSections(menuData, personalMenus) {
  const sections = [];

  [...menuData].sort(bySortOrder).forEach((top) => {
    const children = [...(top.children || [])]
      .sort(bySortOrder)
      .filter(isOpenable);
    const personal = personalMenus.includes(top.name);
    const items =
      children.length > 0 && !personal
        ? children
        : isOpenable(top)
          ? [top]
          : [];

    if (items.length === 0) return;

    sections.push({ key: top.name, title: top.name, tone: TONES[top.name], items });
  });

  return sections;
}

function MenuPageTelegram() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pushScreen, screens } = useScreenStack();
  const { access } = useAuthStore();

  // Корневая вкладка «Меню» — своей истории у неё нет, поэтому системная
  // «Назад» (вместо «Закрыть») ведёт на «Домой». Но «Меню» не размонтируется,
  // пока сверху открыт пункт-экран (Опоздание, Выдача имущества, ...) — активен
  // этот хэндлер должен быть только когда стек экранов пуст, иначе он перехватывает
  // «Назад» из пункта и уводит на «Домой» вместо возврата в список меню.
  useBackHandler(() => navigate("/tg/home"), screens.length === 0);
  const [menuData, setMenuData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Эти страницы открываются экраном поверх (со своей кнопкой «назад»),
  // остальные — обычным переходом по маршруту.
  const stackOpeners = {
    branches: useOpenBranchesPage(),
    departments: useOpenDepartmentsPage(),
    employees: useOpenEmployeesPage(),
    attendance: useOpenAttendancePage(),
    "late-employees": useOpenLateEmployeesPage(),
    "face-passes": useOpenFacePassesPage(),
    "vehicle-passes": useOpenVehiclePassesPage(),
    "batch-receipts": useOpenBatchReceiptsPage(),
    "work-acceptance": useOpenWorkAcceptancePage(),
    operations: useOpenOperationsPage(),
    users: useOpenUsersPage(),
    timesheet: useOpenTimesheetPage(),
    "time-off": useOpenTimeOffPage(),
    positions: useOpenPositionsPage(),
    "work-schedules": useOpenWorkSchedulesPage(),
    "asset-assignments": useOpenAssetAssignmentsPage(),
    "production-report": useOpenProductionReportPage(),
  };

  useEffect(() => {
    getUserMenu({ platform: "telegram" })
      .then(setMenuData)
      .catch((error) => {
        console.error("Ошибка получения меню:", error);
        setMenuData([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const personalMenus = access?.personal_menus;
  const sections = useMemo(
    () => buildSections(menuData, personalMenus || []),
    [menuData, personalMenus],
  );

  const openItem = (item) => {
    const FinanceScreen = FINANCE_SCREENS[item.name];
    const open = stackOpeners[item.name];
    if (FinanceScreen) pushScreen(item.name, <FinanceScreen />);
    else if (open) open();
    else navigate(`/tg${item.path}`);
  };

  if (loading) return <Loading />;

  return (
    <div className={styles.page}>
      <div className={styles.main}>
        {sections.length === 0 ? (
          <p className={styles.empty}>{t("noAccessibleSections")}</p>
        ) : (
          sections.map((section, sectionIndex) => {
            const toneClass =
              styles[
                section.tone ??
                  FALLBACK_TONES[sectionIndex % FALLBACK_TONES.length]
              ];

            return (
              <div className={styles.section} key={section.key}>
                {section.title && (
                  <p className={styles.sectionTitle}>{t(section.title)}</p>
                )}
                <div className={styles.grid}>
                  {section.items.map((item) => (
                    <div
                      key={item.id}
                      className={styles.gridItem}
                      role="button"
                      tabIndex={0}
                      onClick={() => openItem(item)}
                      onKeyDown={(e) => e.key === "Enter" && openItem(item)}
                    >
                      <div className={`${styles.gridIcon} ${toneClass}`}>
                        {getMenuIcon(item.name)}
                      </div>
                      <p className={styles.gridTitle}>{t(item.name)}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default MenuPageTelegram;
