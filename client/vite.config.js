import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5000,
    // https-туннель для Telegram Mini App (cloudflared / ngrok)
    allowedHosts: [
      ".trycloudflare.com",
      ".ngrok-free.app",
      ".ngrok-free.dev",
      ".ngrok.app",
      ".ngrok.io",
    ],
    proxy: {
      "/api": {
        target: "http://localhost:7000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
