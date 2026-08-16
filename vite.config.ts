import { webcrypto } from "node:crypto";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: webcrypto });
}

const basePath = process.env.VITE_BASE_PATH ?? "/";

export default defineConfig({
  base: basePath,
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.svg", "icon-512.svg"],
      manifest: {
        name: "Lorefold",
        short_name: "Lorefold",
        description: "A local-first reader for Linux development discussions.",
        start_url: "./",
        scope: "./",
        display: "standalone",
        theme_color: "#f5f7f8",
        background_color: "#f5f7f8",
        icons: [
          { src: "icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
          { src: "icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg}"],
        navigateFallback: "./index.html",
        runtimeCaching: [],
      },
    }),
  ],
});
