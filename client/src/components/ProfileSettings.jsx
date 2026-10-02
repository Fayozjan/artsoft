import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import {
  useAuthStore,
  DEFAULT_START_PAGE,
  normalizeStartPage,
} from "../stores/authStore";
import { updateProfile, getUserMenu } from "../api/users";
import { startPageOptionsFromTree } from "../utils/startPageOptions";

import styles from "./ProfileSettings.module.scss";

const ProfileSettings = ({ onClose }) => {
  const { t } = useTranslation();
  const { getUserSettings, setUserSettings } = useAuthStore();
  const { showAlert } = useAlertStore();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const {
    theme: storedTheme,
    language: storedLanguage,
    sidebar,
    sidebarPosition: storedSidebarPosition,
    settings: storedSettings,
  } = getUserSettings();

  const [theme, setTheme] = useState(storedTheme || "light");
  const [language, setLanguage] = useState(storedLanguage || "ru");
  const [sidebarPosition, setSidebarPosition] = useState(
    storedSidebarPosition || "left",
  );
  const [startPage, setStartPage] = useState(
    normalizeStartPage(storedSettings?.startPage),
  );
  const [menuData, setMenuData] = useState(null);

  useEffect(() => {
    getUserMenu()
      .then(setMenuData)
      .catch((error) => console.error("Ошибка получения меню:", error));
  }, []);

  const startPageOptions = useMemo(
    () => startPageOptionsFromTree(menuData, t),
    [menuData, t],
  );

  // Сохранённая страница могла стать недоступной — откатываемся на главную
  useEffect(() => {
    if (menuData && !startPageOptions.some((o) => o.path === startPage)) {
      setStartPage(DEFAULT_START_PAGE);
    }
  }, [menuData, startPageOptions, startPage]);

  const togglePassword = (field) => {
    setShowPassword((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword && newPassword !== confirmPassword) {
      showAlert(t("passwordMismatch"), "error");
      return;
    }

    try {
      const nextSettings = {
        ...(storedSettings || {}),
        sidebarPosition,
        startPage,
      };

      const response = await updateProfile({
        currentPassword,
        newPassword,
        theme,
        language,
        settings: nextSettings,
      });

      if (response.success) {
        setUserSettings({
          theme,
          language,
          sidebar,
          sidebarPosition,
          settings: nextSettings,
        });
        showAlert(t("success"), "success");
        setTimeout(() => onClose(), 1000);
      }
    } catch (error) {
      console.log(error);
      showAlert(error?.response?.data?.error, "error");
    }
  };

  return (
    <div className={styles.profileSettings}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputGroup}>
          <label>{t("currentPassword")}</label>
          <input
            type={showPassword.current ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder={t("enterCurrentPassword")}
          />
          <span
            className={styles.togglePassword}
            onClick={() => togglePassword("current")}
          >
            {showPassword.current ? t("hide") : t("show")}
          </span>
        </div>

        <div className={styles.inputGroup}>
          <label>{t("newPassword")}</label>
          <input
            type={showPassword.new ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={t("enterNewPassword")}
          />
          <span
            className={styles.togglePassword}
            onClick={() => togglePassword("new")}
          >
            {showPassword.new ? t("hide") : t("show")}
          </span>
        </div>

        <div className={styles.inputGroup}>
          <label>{t("confirmPassword")}</label>
          <input
            type={showPassword.confirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t("confirmNewPassword")}
          />
          <span
            className={styles.togglePassword}
            onClick={() => togglePassword("confirm")}
          >
            {showPassword.confirm ? t("hide") : t("show")}
          </span>
        </div>

        <div className={styles.flex}>
          <div className={styles.inputGroup}>
            <label>{t("theme")}</label>
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="light">{t("themeLight")}</option>
              <option value="dark">{t("themeDark")}</option>
            </select>
          </div>

          <div className={styles.inputGroup}>
            <label>{t("language")}</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="ru">{t("languageRussian")}</option>
              <option value="uzCyrl">{t("languageUzbekCyrl")}</option>
              <option value="uzLatn">{t("languageUzbekLatn")}</option>
              <option value="en">{t("languageEnglish")}</option>
            </select>
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label>{t("sidebarPosition")}</label>
          <select
            value={sidebarPosition}
            onChange={(e) => setSidebarPosition(e.target.value)}
          >
            <option value="left">{t("sidebarPositionLeft")}</option>
            <option value="top">{t("sidebarPositionTop")}</option>
            <option value="hidden">{t("sidebarPositionHidden")}</option>
          </select>
        </div>

        <div className={styles.inputGroup}>
          <label>{t("startPage")}</label>
          <select
            value={startPage}
            onChange={(e) => setStartPage(e.target.value)}
          >
            {startPageOptions.map(({ path, label }) => (
              <option key={path} value={path}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <button type="submit" className={styles.saveButton}>
          {t("save")}
        </button>
      </form>
    </div>
  );
};

export default ProfileSettings;
