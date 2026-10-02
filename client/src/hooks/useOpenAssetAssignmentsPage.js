import { useCallback } from "react";
import React from "react";
import { useScreenStack } from "../context/ScreenStackContext";
import AssetAssignmentsPageTelegram from "../pages/AssetAssignmentsPageTelegram";

export const useOpenAssetAssignmentsPage = () => {
  const { pushScreen } = useScreenStack();

  return useCallback(() => {
    pushScreen(
      "asset-assignments-page",
      React.createElement(AssetAssignmentsPageTelegram),
    );
  }, [pushScreen]);
};
