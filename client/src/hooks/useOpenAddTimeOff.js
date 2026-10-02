import { useCallback } from "react";
import React from "react";
import { useScreenStack } from "../context/ScreenStackContext";
import TimeOffFormScreenTelegram from "../components/TimeOffFormScreenTelegram";

export const useOpenAddTimeOff = (onSuccess) => {
  const { pushScreen } = useScreenStack();

  return useCallback(() => {
    pushScreen(
      "add-time-off",
      React.createElement(TimeOffFormScreenTelegram, { onSaved: onSuccess }),
    );
  }, [pushScreen, onSuccess]);
};
