import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // App local (ADR 0002 / decisão 7): o bundle único de ~190 kB gzip, quase todo do Recharts, não justifica code-splitting.
  build: { chunkSizeWarningLimit: 800 },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
