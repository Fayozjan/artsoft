import { useState } from "react";

import { useAlertStore } from "../stores/alertStore";
import { useAuthStore } from "../stores/authStore";
import { editUser } from "../api/users";

import styles from "./ProfileSettings.module.scss";

const ProfileSettings = () => {
  const { getUserSettings, setUserSettings } = useAuthStore();
  const { showAlert } = useAlertStore();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const { theme: storedTheme, language: storedLanguage } = getUserSettings();

  const [theme, setTheme] = useState(storedTheme || "light");
  const [language, setLanguage] = useState(storedLanguage || "ru");

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword && newPassword !== confirmPassword) {
      setError("Пароли не совпадают!");
      return;
    }

    try {
      const response = await editUser({
        currentPassword,
        newPassword,
        theme,
        language,
      });

      if (response.success) {
        setUserSettings({ ...response.data });
        showAlert("Успешно", "success");
        setError("");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (error) {
      showAlert("Ошибка", "error");
    }
  };

  return (
    <div className={styles.profileSettings}>
      {error && <p className={styles.error}>{error}</p>}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputGroup}>
          <label>Текущий пароль</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Введите текущий пароль"
          />
        </div>

        <div className={styles.inputGroup}>
          <label>Новый пароль</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Введите новый пароль"
          />
        </div>

        <div className={styles.inputGroup}>
          <label>Подтверждение пароля</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Подтвердите новый пароль"
          />
        </div>

        <div className={styles.inputGroup}>
          <label>Тема</label>
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="light">Светлая</option>
            <option value="dark">Тёмная</option>
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

        <button type="submit" className={styles.saveButton}>
          Сохранить
        </button>
      </form>
    </div>
  );
};

export default ProfileSettings;
