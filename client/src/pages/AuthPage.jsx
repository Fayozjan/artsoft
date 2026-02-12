import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAlertStore } from "../stores/alertStore";
import { useAuthStore } from "../stores/authStore";

import styles from "./AuthPage.module.scss";

const AuthPage = () => {
  const { showAlert } = useAlertStore();
  const { loginUser } = useAuthStore();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [form, setForm] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [currentLang, setCurrentLang] = useState(
    localStorage.getItem("language") || i18n.language,
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleLanguageChange = (lang) => {
    i18n.changeLanguage(lang);
    localStorage.setItem("language", lang);
    setCurrentLang(lang);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const lang = localStorage.getItem("language") || i18n.language;

    const result = await loginUser({
      ...form,
      language: lang,
    });

    result.success
      ? navigate("/dashboard")
      : showAlert(t("loginError"), "error");
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.logo}>
        <img src="/ilm.webp" alt="Logo" />
      </div>

      <div className={styles.lang_switcher}>
        <button
          onClick={() => handleLanguageChange("uzCyrl")}
          className={currentLang === "uzCyrl" ? styles.active : ""}
        >
          ЎЗ
        </button>
        <button
          onClick={() => handleLanguageChange("ru")}
          className={currentLang === "ru" ? styles.active : ""}
        >
          РУ
        </button>
        <button
          onClick={() => handleLanguageChange("en")}
          className={currentLang === "en" ? styles.active : ""}
        >
          ENG
        </button>
      </div>

      <div className={styles.login_card}>
        <h2 className={styles.title}>
          {t("welcome")}
          <span className={styles.subtitle}>{t("welcomeBack")}</span>
        </h2>
        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.input_group}>
            <input
              name="username"
              value={form.username}
              type="text"
              required
              placeholder={t("username")}
              onChange={handleChange}
              className={styles.input_field}
            />
          </div>

          <div className={styles.input_group}>
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              required
              placeholder={t("password")}
              value={form.password}
              onChange={handleChange}
              className={styles.input_field}
            />

            <span
              className={styles.toggle_password}
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? "Скрыть" : "Показать"}
            </span>
          </div>

          <button type="submit" className={styles.submit_button}>
            {t("login")}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthPage;
