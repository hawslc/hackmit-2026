import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The server runs separately (`npm run dev` starts both); proxy /api to it in dev.
    proxy: { "/api": "http://localhost:3001" },
  },
});
