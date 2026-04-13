import { useState } from "react";

import { useAlertStore } from "../stores/alertStore";
import { useAuthStore } from "../stores/authStore";
import { updateProfile } from "../api/users";

import styles from "./ProfileSettings.module.scss";

const ProfileSettings = ({ onClose }) => {
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
      showAlert("Новый пароль и подтверждение не совпадают.", "error");
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
        showAlert("Успешно", "success");
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
          <label>Текущий пароль</label>
          <input
            type={showPassword.current ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Введите текущий пароль"
          />
          <span
            className={styles.togglePassword}
            onClick={() => togglePassword("current")}
          >
            {showPassword.current ? "Скрыть" : "Показать"}
          </span>
        </div>

        <div className={styles.inputGroup}>
          <label>Новый пароль</label>
          <input
            type={showPassword.new ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Введите новый пароль"
          />
          <span
            className={styles.togglePassword}
            onClick={() => togglePassword("new")}
          >
            {showPassword.new ? "Скрыть" : "Показать"}
          </span>
        </div>

        <div className={styles.inputGroup}>
          <label>Подтверждение пароля</label>
          <input
            type={showPassword.confirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Подтвердите новый пароль"
          />
          <span
            className={styles.togglePassword}
            onClick={() => togglePassword("confirm")}
          >
            {showPassword.confirm ? "Скрыть" : "Показать"}
          </span>
        </div>

        <div className={styles.flex}>
          <div className={styles.inputGroup}>
            <label>Тема</label>
            <select value={theme} onChange={(e) => setTheme(e.target.value)}>
              <option value="light">Светлая</option>
              {/* <option value="dark">Тёмная</option> */}
            </select>
          </div>

          <div className={styles.inputGroup}>
            <label>Язык</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="ru">Русский</option>
              <option value="uzCyrl">Узбекский (кириллица)</option>
              <option value="uzLatn">Узбекский (латиница)</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <button type="submit" className={styles.saveButton}>
          Сохранить
        </button>
      </form>
    </div>
  );
};

export default ProfileSettings;
