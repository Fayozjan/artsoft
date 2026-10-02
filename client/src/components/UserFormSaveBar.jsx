import { useTranslation } from "react-i18next";

import { IconCheck } from "./tg/tgIcons";

import ui from "./tg/TgUi.module.scss";
import styles from "./AddUser.module.scss";

// Закреплённый низ формы логина в Telegram: та же синяя кнопка «Сохранить» с галочкой,
// что и в форме «Тип операции». Кнопка submit — отправляет форму, в которой лежит.
const UserFormSaveBar = ({ disabled }) => {
  const { t } = useTranslation();

  return (
    <div className={styles.actionBar}>
      <button
        type="submit"
        className={`${ui.btn} ${ui.btnPrimary}`}
        disabled={disabled}
      >
        <IconCheck />
        <span>{t("save")}</span>
      </button>
    </div>
  );
};

export default UserFormSaveBar;
