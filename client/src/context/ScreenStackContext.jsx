import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
} from "react";

const ScreenStackContext = createContext(null);

const tg = window.Telegram?.WebApp;

export const ScreenStackProvider = ({ children }) => {
  const [screens, setScreens] = useState([]);

  const pushScreen = useCallback((key, component) => {
    setScreens((prev) => [...prev, { key, component }]);
  }, []);

  const popScreen = useCallback(() => {
    setScreens((prev) => prev.slice(0, -1));
  }, []);

  useEffect(() => {
    if (!tg) return;
    if (screens.length > 0) {
      tg.BackButton.show();
      tg.BackButton.onClick(popScreen);
    } else {
      tg.BackButton.hide();
      tg.BackButton.offClick(popScreen);
    }
    return () => tg.BackButton.offClick(popScreen);
  }, [screens, popScreen]);

  return (
    <ScreenStackContext.Provider value={{ screens, pushScreen, popScreen }}>
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

export const ScreenStackRenderer = () => {
  const { screens } = useScreenStack();
  if (screens.length === 0) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 500, overflow: "hidden" }}
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
