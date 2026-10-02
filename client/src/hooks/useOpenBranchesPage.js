import { useCallback } from "react";
import React from "react";
import { useScreenStack } from "../context/ScreenStackContext";
import BranchesPageTelegram from "../pages/BranchesPageTelegram";

export const useOpenBranchesPage = () => {
  const { pushScreen } = useScreenStack();

  return useCallback(() => {
    pushScreen(
      "branches-page",
      React.createElement(BranchesPageTelegram, { routePath: "/branches" }),
    );
  }, [pushScreen]);
};
