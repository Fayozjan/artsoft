import { useCallback } from "react";
import React from "react";
import { useScreenStack } from "../context/ScreenStackContext";
import ProductionReportPageTelegram from "../pages/ProductionReportPageTelegram";

export const useOpenProductionReportPage = () => {
  const { pushScreen } = useScreenStack();

  return useCallback(() => {
    pushScreen(
      "production-report-page",
      React.createElement(ProductionReportPageTelegram, { routePath: "/production-report" }),
    );
  }, [pushScreen]);
};
