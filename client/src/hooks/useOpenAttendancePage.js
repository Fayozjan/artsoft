import { useCallback } from "react";
import React from "react";
import { useScreenStack } from "../context/ScreenStackContext";
import AttendancePageTelegram from "../pages/AttendancePageTelegram";

export const useOpenAttendancePage = (onSuccess) => {
  const { pushScreen, popScreen } = useScreenStack();

  return useCallback(() => {
    pushScreen(
      "attendance-page",
      React.createElement(AttendancePageTelegram, {
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
