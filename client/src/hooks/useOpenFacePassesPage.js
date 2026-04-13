import { useCallback } from "react";
import React from "react";
import { useScreenStack } from "../context/ScreenStackContext";
import FacePassesPageTelegram from "../pages/FacePassesPageTelegram";

export const useOpenFacePassesPage = (onSuccess) => {
  const { pushScreen, popScreen } = useScreenStack();

  return useCallback(() => {
    pushScreen(
      "face-passes-page",
      React.createElement(FacePassesPageTelegram, {
        handleClose: popScreen,
        onSuccess: () => {
          onSuccess?.();
          popScreen();
        },
      }),
    );
  }, [pushScreen, popScreen, onSuccess]);
};
