import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import PermissionsManager from "./PermissionsManager";
import { menuMapToList } from "../utils/menuPermissions";

import styles from "./UserAccessCards.module.scss";

// «Доступные меню» телеграм приложения — секция внутри «Настройки телеграм приложения»:
// отдельный набор прав логина только для телеграма. formData.telegram_menu — карта
// {menuId: {view, add, update, delete}}; null — отдельного набора нет, в телеграме
// действуют веб-права (formData.menu).
const UserTelegramMenuAccess = ({ allMenus, formData, setFormData }) => {
  const { t } = useTranslation();
  const telegramMenu = formData.telegram_menu;
  const custom = Boolean(telegramMenu);

  const currentMenus = useMemo(
    () => menuMapToList(telegramMenu),
    [telegramMenu],
  );

  const setTelegramMenu = useCallback(
    (next) => setFormData((prev) => ({ ...prev, telegram_menu: next })),
    [setFormData],
  );

  // Отдельный набор начинается с текущих веб-прав — админ правит уже готовое
  const chooseCustom = () =>
    setTelegramMenu(custom ? telegramMenu : { ...(formData.menu || {}) });

  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardBody}>
          <div className={styles.block}>
            <div className={styles.blockHead}>
              <span className={styles.blockTitle}>{t("telegramMenuMode")}</span>
              <div className={styles.segment} role="radiogroup">
                <button
                  type="button"
                  role="radio"
                  aria-checked={!custom}
                  className={`${styles.segmentBtn} ${!custom ? styles.segmentActive : ""}`}
                  onClick={() => setTelegramMenu(null)}
                >
                  {t("telegramMenuSame")}
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={custom}
                  className={`${styles.segmentBtn} ${custom ? styles.segmentActive : ""}`}
                  onClick={chooseCustom}
                >
                  {t("telegramMenuCustom")}
                </button>
              </div>
            </div>
            <p className={styles.blockHint}>
              {custom
                ? t("telegramMenuCustomHint")
                : t("telegramMenuSameHint")}
            </p>
          </div>
        </div>
      </section>

      {custom && (
        <PermissionsManager
          allMenus={allMenus}
          userMenus={currentMenus}
          onChange={setTelegramMenu}
        />
      )}
    </>
  );
};

export default UserTelegramMenuAccess;
