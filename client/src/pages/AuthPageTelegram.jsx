import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTelegram } from "../hooks/useTelegram";
import { useAuthStore } from "../stores/authStore";
import styles from "./AuthPageTelegram.module.scss";

const AuthPageTelegram = () => {
  const { user } = useTelegram();
  const navigate = useNavigate();
  const { loginTelegram } = useAuthStore();

  // "loading" | "not_found" | "disabled" | "error"
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  const authStarted = useRef(false);

  const authenticate = async () => {
    if (!user) return;

    setStatus("loading");
    setError(null);

    const result = await loginTelegram(user);

    if (result.success) {
      navigate("/tg/main", { replace: true });
      return;
    }

    setStatus(
      result.errorCode === "NOT_REGISTERED"
        ? "not_found"
        : result.errorCode === "DISABLED"
          ? "disabled"
          : "error",
    );
    setError(result.message || "Произошла ошибка при входе");
    authStarted.current = false;
  };

  useEffect(() => {
    if (user && !authStarted.current) {
      authStarted.current = true;
      authenticate();
    } else if (!user) {
      const timeout = setTimeout(() => {
        setStatus("error");
        setError(
          "Данные Telegram не получены. Откройте приложение внутри Telegram.",
        );
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [user]);

  if (status === "loading") {
    return (
      <div className={styles.screen}>
        <div className={styles.logoWrap}>
          <div className={styles.logo}>
            <span>OB</span>
          </div>
        </div>
        <div className={styles.spinnerWrap}>
          <div className={styles.spinner} />
        </div>
        <p className={styles.hint}>Вход в систему...</p>
      </div>
    );
  }

  if (status === "not_found") {
    return (
      <div className={styles.screen}>
        <div className={styles.iconWrap} data-type="warn">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className={styles.title}>Нет доступа</h2>
        <p className={styles.text}>Вы не зарегистрированы в системе.</p>
        <p className={styles.subtext}>
          Обратитесь к администратору для получения доступа.
        </p>
      </div>
    );
  }

  if (status === "disabled") {
    return (
      <div className={styles.screen}>
        <div className={styles.iconWrap} data-type="warn">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        </div>
        <h2 className={styles.title}>Аккаунт деактивирован</h2>
        <p className={styles.text}>Обратитесь к администратору.</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={styles.screen}>
        <div className={styles.iconWrap} data-type="error">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h2 className={styles.title}>Ошибка входа</h2>
        <p className={styles.text}>{error}</p>
        <button
          className={styles.retryButton}
          onClick={() => {
            authStarted.current = false;
            authenticate();
          }}
        >
          Повторить попытку
        </button>
      </div>
    );
  }

  return null;
};

export default AuthPageTelegram;
