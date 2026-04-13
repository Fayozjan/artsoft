import { useCallback } from "react";
import React from "react";
import { useScreenStack } from "../context/ScreenStackContext";
import VehiclePassesPageTelegram from "../pages/VehiclePassesPageTelegram";

export const useOpenVehiclePassesPage = (onSuccess) => {
  const { pushScreen, popScreen } = useScreenStack();

  return useCallback(() => {
    pushScreen(
      "vehicle-passes-page",
      React.createElement(VehiclePassesPageTelegram, {
        handleClose: popScreen,
        onSuccess: () => {
          onSuccess?.();
          popScreen();
        },
      }),
    );
  }, [pushScreen, popScreen, onSuccess]);
};
