import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";

import TopBannerStack from "./components/TopBannerStack";
import ImagePreviewModal from "./components/ImagePreviewModal";
import Loading from "./components/Loading";

import TelegramLayout from "./layouts/TelegramLayout";

import routes from "./routes";
import telegramRoutes from "./telegramRoutes";
import AuthPageTelegram from "./pages/AuthPageTelegram";

// Веб-версия не нужна Telegram-приложению — грузится отдельным чанком
const WebLayout = lazy(() => import("./layouts/WebLayout"));
const AuthPage = lazy(() => import("./pages/AuthPage"));

export default function App() {
  return (
    <>
      <Suspense fallback={<Loading />}>
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
      </Suspense>
      <TopBannerStack />
      <ImagePreviewModal />
    </>
  );
}
