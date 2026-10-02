import { useTranslation } from "react-i18next";
import { Send, Check, Timer } from "lucide-react";

import UserSidePanel from "./UserSidePanel";
import UserTelegramMenuAccess from "./UserTelegramMenuAccess";

import styles from "./UserAccessCards.module.scss";

const PERSONAL_MENUS = [
  { key: "home", labelKey: "homeNav" },
  { key: "finance", labelKey: "financeNav" },
  { key: "tasks", labelKey: "tasksNav" },
];

// «Настройки телеграм приложения» логина: личный режим меню, право отмечать
// «Начать работу» / «Завершить работу» кнопкой на главной странице и отдельные
// «Доступные меню» телеграма.
// menuSettingsEnabled: false — уровень доступа «сотрудник»: меню у него нет, а личный
// режим ни к чему — там всё и так личное.
const UserTelegramSettings = ({
  panel,
  allMenus,
  formData,
  setFormData,
  menuSettingsEnabled,
}) => {
  const { t } = useTranslation();
  const personalMenus = formData.personal_menus || [];

  const togglePersonalMenu = (key, checked) =>
    setFormData((prev) => {
      const current = prev.personal_menus || [];
      return {
        ...prev,
        personal_menus: checked
          ? [...current, key]
          : current.filter((item) => item !== key),
      };
    });

  const cards = (
    <section className={styles.card}>
      <div className={styles.cardBody}>
        {menuSettingsEnabled && (
          <div className={styles.block}>
            <div className={styles.blockHead}>
              <span className={styles.blockTitle}>{t("personalMenuMode")}</span>
            </div>
            <p className={styles.blockHint}>{t("personalMenuModeHint")}</p>

            <div className={styles.chips}>
              {PERSONAL_MENUS.map(({ key, labelKey }) => {
                const active = personalMenus.includes(key);
                return (
                  <label
                    key={key}
                    className={`${styles.chip} ${active ? styles.chipActive : ""}`}
                  >
                    <input
                      type="checkbox"
                      className={styles.srOnly}
                      checked={active}
                      onChange={(e) => togglePersonalMenu(key, e.target.checked)}
                    />
                    <span className={styles.chipCheck}>
                      <Check size={10} strokeWidth={3.5} />
                    </span>
                    {t(labelKey)}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        <label className={styles.switchRow}>
          <span className={styles.switchIcon}>
            <Timer size={16} />
          </span>
          <input
            type="checkbox"
            className={styles.srOnly}
            checked={Boolean(formData.telegram_work_punch)}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                telegram_work_punch: e.target.checked,
              }))
            }
          />
          <span className={styles.switchText}>
            <b>{t("telegramWorkPunch")}</b>
            <small>{t("telegramWorkPunchHint")}</small>
          </span>
          <span className={styles.switch} aria-hidden="true" />
        </label>
      </div>
    </section>
  );

  return (
    <UserSidePanel
      panel={panel}
      icon={Send}
      title={t("telegramSettings")}
      hint={t("telegramSettingsHint")}
    >
      {cards}

      {menuSettingsEnabled && (
        <UserTelegramMenuAccess
          allMenus={allMenus}
          formData={formData}
          setFormData={setFormData}
        />
      )}
    </UserSidePanel>
  );
};

export default UserTelegramSettings;
