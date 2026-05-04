import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { useAuthStore } from "../stores/authStore";
import { updateProfile } from "../api/users";

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
  } = getUserSettings();

  const [theme, setTheme] = useState(storedTheme || "light");
  const [language, setLanguage] = useState(storedLanguage || "ru");

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
      const response = await updateProfile({
        currentPassword,
        newPassword,
        theme,
        language,
      });

      if (response.success) {
        setUserSettings({ theme, language, sidebar });
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

        <button type="submit" className={styles.saveButton}>
          {t("save")}
        </button>
      </form>
    </div>
  );
};

export default ProfileSettings;
