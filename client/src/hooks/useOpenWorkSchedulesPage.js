import { useCallback } from "react";
import React from "react";
import { useScreenStack } from "../context/ScreenStackContext";
import WorkSchedulesPageTelegram from "../pages/WorkSchedulesPageTelegram";

export const useOpenWorkSchedulesPage = () => {
  const { pushScreen } = useScreenStack();

  return useCallback(() => {
    pushScreen(
      "work-schedules-page",
      React.createElement(WorkSchedulesPageTelegram, { routePath: "/work-schedules" }),
    );
  }, [pushScreen]);
};
