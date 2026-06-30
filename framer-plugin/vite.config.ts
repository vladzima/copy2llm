import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import framer from "vite-plugin-framer";
import mkcert from "vite-plugin-mkcert";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), mkcert(), framer()],
  // Ship the plugin UI unminified so the Marketplace can review it. This is the
  // editor-side bundle only; the widget written into published sites is a
  // separate, already-built artifact embedded as a string (copy2llm.global.js).
  build: { minify: false },
});
