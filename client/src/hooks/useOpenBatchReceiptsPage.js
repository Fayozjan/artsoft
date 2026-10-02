import { useCallback } from "react";
import React from "react";
import { useScreenStack } from "../context/ScreenStackContext";
import BatchReceiptsPageTelegram from "../pages/BatchReceiptsPageTelegram";

export const useOpenBatchReceiptsPage = () => {
  const { pushScreen } = useScreenStack();

  return useCallback(() => {
    pushScreen(
      "batch-receipts-page",
      React.createElement(BatchReceiptsPageTelegram, { routePath: "/batch-receipts" }),
    );
  }, [pushScreen]);
};
