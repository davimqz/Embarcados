import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

const SERVIDOR = "http://localhost:3000";
const PROXY = {
  "/api": SERVIDOR,
  "/ws": { target: SERVIDOR, ws: true },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // App local (ADR 0002 / decisão 7): o bundle único de ~190 kB gzip, quase todo do Recharts, não justifica code-splitting.
  build: { chunkSizeWarningLimit: 800 },
  // Servidor do painel (backend/ingest/servidor.ts, T4.6): WebSocket em /ws e REST em /api.
  server: { proxy: PROXY },
  preview: { proxy: PROXY },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
