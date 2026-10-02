import { useRef } from "react";

import { useScreenStack } from "../context/ScreenStackContext";

import AddUser from "./AddUser";
import EditUser from "./EditUser";

import styles from "./UserFormScreenTelegram.module.scss";

// Экран добавления / правки логина в Telegram: форма (та же, что и в вебе) на весь
// экран поверх страницы. Без sidePanels формы показывают «Доступные меню» и
// «Настройки телеграм приложения» прямо под полями, а не в боковой панели.
// id не передан — добавление, иначе правка логина с этим id.
const UserFormScreenTelegram = ({ id, onSaved }) => {
  const { popScreen } = useScreenStack();
  const closedRef = useRef(false);

  // Форма после сохранения зовёт и onSuccess, и (с задержкой) handleClose —
  // экран закрываем один раз, иначе второй popScreen снимет чужой экран.
  const close = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    popScreen();
  };

  const formProps = {
    mobile: true,
    handleClose: close,
    onSuccess: () => {
      onSaved?.();
      close();
    },
  };

  return (
    <div className={styles.screen}>
      <div className={styles.topGlass} />
      <div className={styles.scroll}>
        {id ? <EditUser id={id} {...formProps} /> : <AddUser {...formProps} />}
      </div>
    </div>
  );
};

export default UserFormScreenTelegram;
