import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useRef,
} from "react";

const ScreenStackContext = createContext(null);

const tg = window.Telegram?.WebApp;

export const ScreenStackProvider = ({ children }) => {
  const [screens, setScreens] = useState([]);
  // Реагирует на регистрацию хэндлеров вне стека (например, корневая страница
  // «Меню» показывает системную «Назад» без пуша экрана) — see useBackHandler.
  const [handlerCount, setHandlerCount] = useState(0);

  const pushScreen = useCallback((key, component) => {
    setScreens((prev) => [...prev, { key, component }]);
  }, []);

  const popScreen = useCallback(() => {
    setScreens((prev) => prev.slice(0, -1));
  }, []);

  // Экран может перехватить «назад» (например, выйти на уровень выше внутри себя,
  // а не закрываться целиком): верхний зарегистрированный обработчик идёт вместо popScreen.
  const backHandlersRef = useRef([]);

  const registerBackHandler = useCallback((handler) => {
    backHandlersRef.current.push(handler);
    setHandlerCount(backHandlersRef.current.length);
    return () => {
      backHandlersRef.current = backHandlersRef.current.filter((h) => h !== handler);
      setHandlerCount(backHandlersRef.current.length);
    };
  }, []);

  const handleBack = useCallback(() => {
    const handlers = backHandlersRef.current;
    if (handlers.length > 0) handlers[handlers.length - 1]();
    else popScreen();
  }, [popScreen]);

  useEffect(() => {
    if (!tg) return;
    if (screens.length > 0 || handlerCount > 0) {
      tg.BackButton.show();
      tg.BackButton.onClick(handleBack);
    } else {
      tg.BackButton.hide();
      tg.BackButton.offClick(handleBack);
    }
    return () => tg.BackButton.offClick(handleBack);
  }, [screens, handlerCount, handleBack]);

  return (
    <ScreenStackContext.Provider
      value={{ screens, pushScreen, popScreen, registerBackHandler }}
    >
      {children}
    </ScreenStackContext.Provider>
  );
};

export const useScreenStack = () => {
  const ctx = useContext(ScreenStackContext);
  if (!ctx)
    throw new Error("useScreenStack must be used inside ScreenStackProvider");
  return ctx;
};

// Пока active — системная кнопка «назад» Telegram вызывает handler, а не закрывает экран.
export const useBackHandler = (handler, active = true) => {
  const { registerBackHandler } = useScreenStack();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!active) return undefined;
    return registerBackHandler(() => handlerRef.current());
  }, [active, registerBackHandler]);
};

export const ScreenStackRenderer = () => {
  const { screens } = useScreenStack();
  if (screens.length === 0) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 500, overflow: "hidden", background: "var(--tg-bg)" }}
    >
      {screens.map((screen, i) => {
        const isTop = i === screens.length - 1;
        const isBehind = i === screens.length - 2;
        // все остальные — полностью скрыты за левым краем

        let transform = "translateX(-100%)"; // ← было 100%, теперь -100%
        let opacity = 0;
        let pointerEvents = "none";
        let zIndex = 0;

        if (isTop) {
          transform = "translateX(0)";
          opacity = 1;
          pointerEvents = "auto";
          zIndex = 10;
        } else if (isBehind) {
          transform = "translateX(-30%)"; // iOS-паттерн: предыдущий экран чуть левее
          opacity = 1;
          pointerEvents = "none";
          zIndex = 5;
        }

        return (
          <div
            key={screen.key}
            style={{
              position: "absolute",
              inset: 0,
              transform,
              opacity,
              pointerEvents,
              zIndex,
              transition:
                "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              willChange: "transform",
              overflow: "hidden",
            }}
          >
            {screen.component}
          </div>
        );
      })}
    </div>
  );
};
