import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/driver": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
      "/passenger": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
      "/dispatcher": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
});
