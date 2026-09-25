import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    // Dev proxy: /reviews/* and /chats/* → FastAPI backend (no CORS issues in dev,
    // and the frontend code can use relative URLs everywhere)
    proxy: {
      "/reviews": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/chats": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/models": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});