import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT || 3000),
    hmr: { protocol: "wss", clientPort: 443 },
  },
  preview: {
    host: "0.0.0.0",
    port: Number(process.env.PORT || 3000),
  },
});
