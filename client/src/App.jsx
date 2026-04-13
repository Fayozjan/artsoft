import { Routes, Route } from "react-router-dom";

import Alert from "./components/Alert";

import WebLayout from "./layouts/WebLayout";
import TelegramLayout from "./layouts/TelegramLayout";

import routes from "./routes";
import telegramRoutes from "./telegramRoutes";
import AuthPage from "./pages/AuthPage";
import AuthPageTelegram from "./pages/AuthPageTelegram";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<AuthPage />} key="/" />,
        <Route path="/*" element={<WebLayout />}>
          {routes}
        </Route>
        <Route path="/tg" element={<AuthPageTelegram />} key="/" />,
        <Route path="/tg/*" element={<TelegramLayout />}>
          {telegramRoutes}
        </Route>
      </Routes>
      <Alert />
    </>
  );
}
