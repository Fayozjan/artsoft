import { useCallback } from "react";
import React from "react";
import { useScreenStack } from "../context/ScreenStackContext";
import OperationsPageTelegram from "../pages/OperationsPageTelegram";

export const useOpenOperationsPage = () => {
  const { pushScreen } = useScreenStack();

  return useCallback(() => {
    pushScreen(
      "operations-page",
      React.createElement(OperationsPageTelegram, { routePath: "/operations" }),
    );
  }, [pushScreen]);
};
