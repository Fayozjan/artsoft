import { useCallback } from "react";
import React from "react";
import { useScreenStack } from "../context/ScreenStackContext";
import DepartmentsPageTelegram from "../pages/DepartmentsPageTelegram";

export const useOpenDepartmentsPage = () => {
  const { pushScreen } = useScreenStack();

  return useCallback(() => {
    pushScreen(
      "departments-page",
      React.createElement(DepartmentsPageTelegram, { routePath: "/departments" }),
    );
  }, [pushScreen]);
};
