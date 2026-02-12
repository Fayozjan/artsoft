import { useEffect, useState } from "react";
import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useOutlet, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Icons } from "./icons/icons";

import { useAuthCheck } from "./hooks/useAuthCheck";
import { useAuthStore } from "./stores/authStore";
import { getUserMenu } from "./api";

import Sidebar from "./components/Sidebar";
import Loading from "./components/Loading";

import styles from "./layout.module.scss";

export default function HrLayout() {
  const { getUserSettings } = useAuthStore();
  const location = useLocation();
  const outlet = useOutlet();
  const [menuData, setMenuData] = useState([]);
  const { theme: storedTheme } = getUserSettings();
  const { loading, isAuth } = useAuthCheck();
  const { t } = useTranslation();

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
      }
    };
    fetchUserMenu();
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    if (storedTheme === "dark") {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
  }, [storedTheme]);

  if (loading) {
    return <Loading />;
  }

  if (!isAuth) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className={styles.layout}>
      <Sidebar menuData={menuData} />

      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.1 } }}
          exit={{ opacity: 0, y: -20, transition: { duration: 0.1 } }}
          className={styles.page}
        >
          <h2 className={styles.pageTitle}>
            <span className={!currentMenu.foundSubmenu ? styles.subTitle : ""}>
              {currentMenu.foundMenu && t(currentMenu.foundMenu.name)}
            </span>

            {currentMenu.foundSubmenu && (
              <>
                <span className={styles.arrow}>{Icons.arrowRight}</span>

                <span className={styles.subTitle}>
                  {t(currentMenu.foundSubmenu.name)}
                </span>
              </>
            )}
          </h2>
          {outlet}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
