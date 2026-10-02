import { useTranslation } from "react-i18next";

import { updateProfile } from "../api";
import { useAuthStore } from "../stores/authStore";
import { IconChevronRight } from "../components/tg/tgIcons";

import styles from "./SettingsPageTelegram.module.scss";

const SUPPORT_URL = "https://t.me/fayoz7";

function SettingsPageTelegram() {
  const { t } = useTranslation();
  const { userSettings, setUserSettings } = useAuthStore();
  const { theme, language } = userSettings;

  const handleThemeChange = async (value) => {
    setUserSettings({ theme: value });
    try {
      await updateProfile({ theme: value });
    } catch (e) {
      console.error(e);
    }
  };

  const handleLanguageChange = async (value) => {
    setUserSettings({ language: value });
    try {
      await updateProfile({ language: value });
    } catch (e) {
      console.error(e);
    }
  };

  const handleHelp = () => {
    const tg = window.Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(SUPPORT_URL);
    } else {
      window.open(SUPPORT_URL, "_blank", "noopener");
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.main}>
        <div className={styles.settingsCard}>
          <div className={styles.settingsRow}>
            <span className={styles.settingsLabel}>{t("theme")}</span>
            <div className={styles.themePills}>
              <button
                className={`${styles.pill} ${theme === "light" ? styles.pillActive : ""}`}
                onClick={() => handleThemeChange("light")}
              >
                {t("themeLight")}
              </button>
              <button
                className={`${styles.pill} ${theme === "dark" ? styles.pillActive : ""}`}
                onClick={() => handleThemeChange("dark")}
              >
                {t("themeDark")}
              </button>
            </div>
          </div>

          <div className={styles.settingsRow}>
            <span className={styles.settingsLabel}>{t("language")}</span>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className={styles.languageSelect}
            >
              <option value="ru">{t("languageRussian")}</option>
              <option value="uzCyrl">{t("languageUzbekCyrl")}</option>
              <option value="uzLatn">{t("languageUzbekLatn")}</option>
              <option value="en">{t("languageEnglish")}</option>
            </select>
          </div>

          <button
            type="button"
            className={`${styles.settingsRow} ${styles.linkRow}`}
            onClick={handleHelp}
          >
            <span className={styles.settingsLabel}>{t("help")}</span>
            <span className={styles.linkChevron}>
              <IconChevronRight />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsPageTelegram;
