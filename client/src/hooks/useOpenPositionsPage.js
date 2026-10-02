import { useCallback } from "react";
import React from "react";
import { useScreenStack } from "../context/ScreenStackContext";
import PositionsPageTelegram from "../pages/PositionsPageTelegram";

export const useOpenPositionsPage = () => {
  const { pushScreen } = useScreenStack();

  return useCallback(() => {
    pushScreen(
      "positions-page",
      React.createElement(PositionsPageTelegram, { routePath: "/positions" }),
    );
  }, [pushScreen]);
};
