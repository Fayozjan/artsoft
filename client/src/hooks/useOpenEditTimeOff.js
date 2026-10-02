import { useCallback } from "react";
import React from "react";
import { useScreenStack } from "../context/ScreenStackContext";
import TimeOffFormScreenTelegram from "../components/TimeOffFormScreenTelegram";

export const useOpenEditTimeOff = (onSuccess) => {
  const { pushScreen } = useScreenStack();

  return useCallback(
    (id) => {
      pushScreen(
        `edit-time-off-${id}`,
        React.createElement(TimeOffFormScreenTelegram, {
          id,
          onSaved: onSuccess,
        }),
      );
    },
    [pushScreen, onSuccess],
  );
};
