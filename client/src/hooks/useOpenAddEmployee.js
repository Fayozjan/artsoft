import { useCallback } from "react";
import React from "react";
import { useScreenStack } from "../context/ScreenStackContext";
import EmployeeFormScreenTelegram from "../components/EmployeeFormScreenTelegram";

export const useOpenAddEmployee = (onSuccess) => {
  const { pushScreen } = useScreenStack();

  return useCallback(() => {
    pushScreen(
      "add-employee",
      React.createElement(EmployeeFormScreenTelegram, { onSaved: onSuccess }),
    );
  }, [pushScreen, onSuccess]);
};
