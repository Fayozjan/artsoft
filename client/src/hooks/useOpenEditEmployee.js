import { useCallback } from "react";
import React from "react";
import { useScreenStack } from "../context/ScreenStackContext";
import EditEmployeeTelegram from "../components/EditEmployeeTelegram";

export const useOpenEditEmployee = (onSuccess) => {
  const { pushScreen, popScreen } = useScreenStack();

  return useCallback(
    (employeeId) => {
      pushScreen(
        `edit-employee-${employeeId}`,
        React.createElement(EditEmployeeTelegram, {
          id: employeeId,
          handleClose: popScreen,
          onSuccess: () => {
            onSuccess?.();
            popScreen();
          },
        }),
      );
    },
    [pushScreen, popScreen, onSuccess],
  );
};
