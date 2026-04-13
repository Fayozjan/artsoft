import { useState, useEffect } from "react";

export const useTelegram = () => {
  const [isTelegram, setIsTelegram] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;

    if (tg?.initData) {
      tg.ready();
      tg.expand();

      setIsTelegram(true);
      setUser(tg.initDataUnsafe?.user);
    }
  }, []);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    console.log("tg:", tg);
    console.log("initData:", tg?.initData);
    console.log("platform:", tg?.platform);
  }, []);

  return {
    isTelegram,
    tg: window.Telegram?.WebApp,
    user,
    onClose: () => window.Telegram?.WebApp?.close(),
    onToggleButton: () => {
      if (window.Telegram?.WebApp?.MainButton.isVisible) {
        window.Telegram.WebApp.MainButton.hide();
      } else {
        window.Telegram.WebApp.MainButton.show();
      }
    },
  };
};
