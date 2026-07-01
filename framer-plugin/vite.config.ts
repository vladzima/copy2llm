import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import framer from "vite-plugin-framer";
import mkcert from "vite-plugin-mkcert";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), mkcert(), framer()],
  // Build the plugin (incl. the copy2llm-react/-widget it bundles for the live
  // preview) with the local-only flag. Minification is required so the dead
  // third-party deep-link branches are eliminated from the plugin bundle too —
  // nothing anywhere in this plugin can send page content off-site. The injected
  // runtime script is the open-source copy2llm widget, identified by a versioned
  // banner and auditable in the repo.
  define: { __C2L_EXTERNAL__: "false" },
});
