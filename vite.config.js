import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Important for Electron production builds (file:// protocol).
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true
  }
});
