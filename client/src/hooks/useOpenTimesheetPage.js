import { useCallback } from "react";
import React from "react";
import { useScreenStack } from "../context/ScreenStackContext";
import TimesheetPageTelegram from "../pages/TimesheetPageTelegram";

export const useOpenTimesheetPage = () => {
  const { pushScreen } = useScreenStack();

  return useCallback(() => {
    pushScreen("timesheet-page", React.createElement(TimesheetPageTelegram));
  }, [pushScreen]);
};
