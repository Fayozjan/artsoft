import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTelegram } from "../hooks/useTelegram";
import { useAuthStore } from "../stores/authStore";
import styles from "./AuthPageTelegram.module.scss";

const AuthPageTelegram = () => {
  const { t } = useTranslation();
  const { user } = useTelegram();
  const navigate = useNavigate();
  const { loginTelegram } = useAuthStore();

  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  const authStarted = useRef(false);

  const authenticate = async () => {
    if (!user) return;

    setStatus("loading");
    setError(null);

    const result = await loginTelegram(user);

    if (result.success) {
      navigate("/tg/home", { replace: true });
      return;
    }

    setStatus(
      result.errorCode === "NOT_REGISTERED"
        ? "not_found"
        : result.errorCode === "DISABLED"
          ? "disabled"
          : "error",
    );
    setError(result.message || t("loginErrorTelegram"));
    authStarted.current = false;
  };

  useEffect(() => {
    if (user && !authStarted.current) {
      authStarted.current = true;
      authenticate();
    } else if (!user) {
      const timeout = setTimeout(() => {
        setStatus("error");
        setError(t("telegramDataMissing"));
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
        <p className={styles.hint}>{t("loggingIn")}</p>
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
        <h2 className={styles.title}>{t("noAccessTitle")}</h2>
        <p className={styles.text}>{t("notRegistered")}</p>
        <p className={styles.subtext}>{t("contactAdmin")}</p>
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
        <h2 className={styles.title}>{t("accountDeactivated")}</h2>
        <p className={styles.text}>{t("contactAdminShort")}</p>
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
        <h2 className={styles.title}>{t("loginErrorTitle")}</h2>
        <p className={styles.text}>{error}</p>
        <button
          className={styles.retryButton}
          onClick={() => {
            authStarted.current = false;
            authenticate();
          }}
        >
          {t("retry")}
        </button>
      </div>
    );
  }

  return null;
};

export default AuthPageTelegram;
