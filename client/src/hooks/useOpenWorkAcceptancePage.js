import { useCallback } from "react";
import React from "react";
import { useScreenStack } from "../context/ScreenStackContext";
import WorkAcceptancePageTelegram from "../pages/WorkAcceptancePageTelegram";

export const useOpenWorkAcceptancePage = () => {
  const { pushScreen } = useScreenStack();

  return useCallback(() => {
    pushScreen(
      "work-acceptance-page",
      React.createElement(WorkAcceptancePageTelegram, { routePath: "/work-acceptance" }),
    );
  }, [pushScreen]);
};
