import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: [
        "icons/icon.svg",
        "icons/apple-touch-icon-180.png",
        "icons/icon-192.png",
        "icons/icon-512.png",
        "icons/icon-512-maskable.png",
      ],
      manifest: {
        name: "Commonplace",
        short_name: "Commonplace",
        description:
          "A quiet daily home for writing, tasks, priorities, and habits.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        lang: "en",
        background_color: "#F3F1EE",
        theme_color: "#F3F1EE",
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "icons/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // iOS reads launch images once at install; they need not be offline.
        globIgnores: ["splash/**"],
        skipWaiting: false,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: {
    target: "es2020",
    manifest: true,
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id))
            return "react";
          if (id.includes("/node_modules/framer-motion/")) return "motion";
          if (/\/node_modules\/(@tiptap\/|prosemirror-)/.test(id))
            return "tiptap";
          if (id.includes("/node_modules/dexie/")) return "dexie";
        },
      },
    },
  },
});
