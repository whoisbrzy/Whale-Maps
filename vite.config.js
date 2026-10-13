import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In `npm run dev`, forward API and login requests to server.js (run it with `npm start`).
// Use PUBLIC_URL=http://localhost:5173 in .env so the Discord redirect comes back to Vite.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/auth": "http://localhost:3000",
    },
  },
});
