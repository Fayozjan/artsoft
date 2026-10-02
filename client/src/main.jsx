import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import "./i18n";
import "./themes.scss";
import "./tailwind.css";

// После деплоя старые хешированные чанки исчезают: открытое приложение получает
// ошибку динамического импорта — перезагружаем, чтобы взять свежий index.html
window.addEventListener("vite:preloadError", () => window.location.reload());

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
