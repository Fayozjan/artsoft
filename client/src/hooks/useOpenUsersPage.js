import { useCallback } from "react";
import React from "react";
import { useScreenStack } from "../context/ScreenStackContext";
import UsersPageTelegram from "../pages/UsersPageTelegram";

export const useOpenUsersPage = () => {
  const { pushScreen } = useScreenStack();

  return useCallback(() => {
    pushScreen(
      "users-page",
      React.createElement(UsersPageTelegram, { routePath: "/users" }),
    );
  }, [pushScreen]);
};
