import { Fragment, Suspense, useEffect, useState } from "react";
import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useOutlet, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAuthCheck } from "../hooks/useAuthCheck";
import { useAuthStore } from "../stores/authStore";
import { useWidgetsStore } from "../stores/widgetsStore";

import { getUserMenu } from "../api";

import PageHeader from "../components/PageHeader";
import Sidebar from "../components/Sidebar";
import Loading from "../components/Loading";

import styles from "./WebLayout.module.scss";

export default function WebLayout() {
  const { getUserSettings } = useAuthStore();
  const location = useLocation();
  const isHomePage = location.pathname === "/home";

  if (window.Telegram?.WebApp?.initData) {
    return <Navigate to="/tg" replace />;
  }
  const outlet = useOutlet();
  const [menuData, setMenuData] = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);
  // В полноэкранном режиме (экран столовой, дашборды на ТВ) остаётся
  // только контент: сайдбар и заголовок съедают место и отвлекают.
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== "undefined" && !!document.fullscreenElement,
  );
  const { theme: storedTheme } = getUserSettings();
  const { loading, isAuth } = useAuthCheck();
  const { userSettings } = useAuthStore();
  const { widgetsVisible, toggleWidgets } = useWidgetsStore();
  const language = userSettings.language;
  const sidebarPosition = userSettings.sidebarPosition || "left";
  // В режиме «по филиалу» сотрудников отбирает сервер по выбранному филиалу.
  // Смена филиала перемонтирует страницу, чтобы все её списки, фильтры и формы
  // перезапросили данные, а не остались с сотрудниками прежнего филиала.
  const branchScopeKey =
    userSettings.viewMode === "branch"
      ? (userSettings.activeBranchId ?? "none")
      : "all";
  const { i18n, t } = useTranslation();

  useEffect(() => {
    if (language) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  const currentMenu = useMemo(() => {
    if (!menuData || !location?.pathname) return {};

    let foundMenu = null;
    let foundSubmenu = null;

    for (const menu of menuData) {
      if (menu.path === location.pathname) {
        foundMenu = menu;
        break;
      }
      if (menu.children?.length) {
        const sub = menu.children.find((child) =>
          location.pathname.startsWith(child.path),
        );
        if (sub) {
          foundMenu = menu;
          foundSubmenu = sub;
          break;
        }
      }
    }

    return { foundMenu, foundSubmenu };
  }, [menuData, location.pathname]);

  useEffect(() => {
    const fetchUserMenu = async () => {
      try {
        const res = await getUserMenu();
        setMenuData(res);
      } catch (error) {
        console.error("Ошибка получения меню:", error);
      } finally {
        setMenuLoading(false);
      }
    };

    fetchUserMenu();

    const handleVisibility = () => {
      if (!document.hidden) fetchUserMenu();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    const handleFullscreen = () =>
      setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreen);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreen);
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (storedTheme === "dark") {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
  }, [storedTheme]);

  const isAllowedPath = useMemo(() => {
    if (menuLoading || !menuData.length) return true;
    const pathname = location.pathname;
    if (pathname === "/home") return true;
    for (const menu of menuData) {
      if (menu.path === pathname) return !!menu.permissions?.view;
      if (menu.children?.length) {
        const child = menu.children.find((child) =>
          pathname.startsWith(child.path),
        );
        if (child) return !!child.permissions?.view;
      }
    }
    return false;
  }, [menuLoading, menuData, location.pathname]);

  if (loading || menuLoading) {
    return <Loading />;
  }

  if (!isAuth) {
    return <Navigate to="/" replace />;
  }

  if (!isAllowedPath) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div
      className={`${styles.layout} ${
        sidebarPosition === "top"
          ? styles.layoutTop
          : sidebarPosition === "hidden"
            ? styles.layoutHidden
            : styles.layoutLeft
      }`}
    >
      {!isFullscreen && <Sidebar menuData={menuData} />}

      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.1 } }}
          exit={{ opacity: 0, y: -20, transition: { duration: 0.1 } }}
          className={styles.page}
        >
          {!isHomePage && !isFullscreen && (
            <PageHeader
              menuData={menuData}
              currentMenu={currentMenu}
              widgetsVisible={widgetsVisible}
              toggleWidgets={toggleWidgets}
            />
          )}
          <Suspense fallback={<Loading />}>
            <Fragment key={branchScopeKey}>{outlet}</Fragment>
          </Suspense>
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
