import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useOutlet, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAuthCheck } from "../hooks/useAuthCheck";
import { useAuthStore } from "../stores/authStore";

import { getUserMenu } from "../api";

import Loading from "../components/Loading";

import BottomNavTelegram from "../components/BottomNavTelegram";
import {
  ScreenStackProvider,
  ScreenStackRenderer,
} from "../context/ScreenStackContext";

import styles from "./TelegramLayout.module.scss";

export default function TelegramLayout() {
  const { getUserSettings } = useAuthStore();
  const location = useLocation();
  const outlet = useOutlet();
  const [menuData, setMenuData] = useState([]);
  const { theme: storedTheme } = getUserSettings();
  const { loading, isAuth } = useAuthCheck();
  const { userSettings } = useAuthStore();
  const language = userSettings.language;
  const { i18n, t } = useTranslation();

  useEffect(() => {
    if (language) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

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
    return <Navigate to="/tg" replace />;
  }

  return (
    <ScreenStackProvider>
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.1 } }}
          exit={{ opacity: 0, y: -20, transition: { duration: 0.1 } }}
          className={styles.page}
        >
          {outlet}
        </motion.main>
      </AnimatePresence>
      <ScreenStackRenderer />
      <BottomNavTelegram menuData={menuData} />
    </ScreenStackProvider>
  );
}
