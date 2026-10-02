import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Sun, Moon } from "lucide-react";
import { useAlertStore } from "../stores/alertStore";
import { useAuthStore, normalizeStartPage } from "../stores/authStore";

import styles from "./AuthPage.module.scss";

// код ошибки от сервера -> ключ перевода
const ERROR_KEYS = {
  AUTH_INVALID_CREDENTIALS: "loginError",
  NOT_REGISTERED: "notRegistered",
  DISABLED: "accountDisabled",
  TOO_MANY_ATTEMPTS: "tooManyAttempts",
};

const AuthPage = () => {
  const { showAlert } = useAlertStore();
  const { loginUser } = useAuthStore();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    if (window.Telegram?.WebApp?.initData) {
      navigate("/tg", { replace: true });
    }
  }, []);

  const [form, setForm] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [currentLang, setCurrentLang] = useState(
    localStorage.getItem("language") || i18n.language,
  );
  const [isDark, setIsDark] = useState(
    () => (localStorage.getItem("theme") || "light") === "dark",
  );

  useEffect(() => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

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

    const result = await loginUser({ ...form, language: lang, theme: isDark ? "dark" : "light" });

    if (result.success) {
      // loginUser уже загрузил settings пользователя; недоступный путь
      // WebLayout сам перенаправит на /home
      const { settings } = useAuthStore.getState().userSettings;
      navigate(normalizeStartPage(settings?.startPage));
      return;
    }

    // 429 — временная блокировка конкретного логина за перебор пароля
    if (result.status === 429 || result.code === "TOO_MANY_ATTEMPTS") {
      showAlert(
        t("tooManyAttempts", { minutes: result.retryAfterMinutes ?? 15 }),
        "error",
      );
      return;
    }

    // предупреждаем, сколько попыток осталось до блокировки
    if (
      result.code === "AUTH_INVALID_CREDENTIALS" &&
      Number.isFinite(result.attemptsLeft)
    ) {
      showAlert(
        t("loginErrorAttemptsLeft", { attempts: result.attemptsLeft }),
        "error",
      );
      return;
    }

    const key = ERROR_KEYS[result.code];
    showAlert(key ? t(key) : t("error"), "error");
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.logoWrapper}>
        <img src="/logo.png" alt="Logo" className={styles.logo} />
        <span>OnBase</span>
      </div>

      <div className={styles.top_right}>
        <button
          className={styles.theme_toggle}
          onClick={() => setIsDark((prev) => !prev)}
          type="button"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div className={styles.lang_switcher}>
        <button
          onClick={() => handleLanguageChange("ru")}
          className={currentLang === "ru" ? styles.active : ""}
        >
          РУ
        </button>
        <button
          onClick={() => handleLanguageChange("uzLatn")}
          className={currentLang === "uzLatn" ? styles.active : ""}
        >
          UZ
        </button>
        <button
          onClick={() => handleLanguageChange("uzCyrl")}
          className={currentLang === "uzCyrl" ? styles.active : ""}
        >
          ЎЗ
        </button>
        <button
          onClick={() => handleLanguageChange("en")}
          className={currentLang === "en" ? styles.active : ""}
        >
          ENG
        </button>
      </div>
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
              className={`${styles.input_field} ${styles.input_field_password}`}
            />
            <span
              className={styles.toggle_password}
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? t("hide") : t("show")}
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
