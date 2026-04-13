import { useCallback } from "react";
import React from "react";
import { useScreenStack } from "../context/ScreenStackContext";
import AddFacePassTelegram from "../components/AddFacePassTelegram";

export const useOpenAddFacePassTelegram = (onSuccess) => {
  const { pushScreen, popScreen } = useScreenStack();

  return useCallback(() => {
    pushScreen(
      "add-face-pass-telegram",
      React.createElement(AddFacePassTelegram, {
        handleClose: popScreen,
        onSuccess: () => {
          onSuccess?.();
          popScreen();
        },
      }),
    );
  }, [pushScreen, popScreen, onSuccess]);
};
