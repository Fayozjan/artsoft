import { useCallback } from "react";
import React from "react";
import { useScreenStack } from "../context/ScreenStackContext";
import LateEmployeesPageTelegram from "../pages/LateEmployeesPageTelegram";

export const useOpenLateEmployeesPage = () => {
  const { pushScreen } = useScreenStack();

  return useCallback(() => {
    pushScreen(
      "late-employees-page",
      React.createElement(LateEmployeesPageTelegram),
    );
  }, [pushScreen]);
};
