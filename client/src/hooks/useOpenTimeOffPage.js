import { useCallback } from "react";
import React from "react";
import { useScreenStack } from "../context/ScreenStackContext";
import TimeOffPageTelegram from "../pages/TimeOffPageTelegram";

export const useOpenTimeOffPage = () => {
  const { pushScreen } = useScreenStack();

  return useCallback(() => {
    pushScreen(
      "time-off-page",
      React.createElement(TimeOffPageTelegram, { routePath: "/time-off" }),
    );
  }, [pushScreen]);
};
