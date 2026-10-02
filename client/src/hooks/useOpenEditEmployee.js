import { useCallback } from "react";
import React from "react";
import { useScreenStack } from "../context/ScreenStackContext";
import EmployeeFormScreenTelegram from "../components/EmployeeFormScreenTelegram";

export const useOpenEditEmployee = (onSuccess) => {
  const { pushScreen } = useScreenStack();

  return useCallback(
    (employeeId) => {
      pushScreen(
        `edit-employee-${employeeId}`,
        React.createElement(EmployeeFormScreenTelegram, {
          id: employeeId,
          onSaved: onSuccess,
        }),
      );
    },
    [pushScreen, onSuccess],
  );
};
