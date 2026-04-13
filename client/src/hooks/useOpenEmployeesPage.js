import { useCallback } from "react";
import React from "react";
import { useScreenStack } from "../context/ScreenStackContext";
import EmployeesPageTelegram from "../pages/EmployeesPageTelegram";

export const useOpenEmployeesPage = (onSuccess) => {
  const { pushScreen, popScreen } = useScreenStack();

  return useCallback(() => {
    pushScreen(
      "employees-page",
      React.createElement(EmployeesPageTelegram, {
        routePath: "/employees",
        handleClose: popScreen,
        onSuccess: () => {
          onSuccess?.();
          popScreen();
        },
      }),
    );
  }, [pushScreen, popScreen, onSuccess]);
};
