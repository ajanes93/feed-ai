import path from "path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  ssgOptions: {
    script: "async",
    includedRoutes: () => ["/", "/methodology", "/dashboard"],
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, "..")],
    },
    proxy: {
      "/api": "http://localhost:8788",
    },
  },
});
