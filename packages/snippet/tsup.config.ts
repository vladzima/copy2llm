import { defineConfig } from "tsup";

// The snippet is injected into other people's pages, so it inlines everything
// (widget + core + Readability + Turndown) into a single minified IIFE.
//
// Two bundles are produced:
//  - copy2llm.global.js        full-featured (copy/view + external AI targets)
//  - copy2llm.local.global.js  local-only: `__C2L_EXTERNAL__=false` dead-code-
//    eliminates every third-party deep-link path, so the built script has NO
//    ability to send page content anywhere. This is what the Framer plugin
//    injects into published pages.
const common = {
  format: ["iife"] as const,
  platform: "browser" as const,
  noExternal: [/.*/],
  minify: true,
  treeshake: true,
  dts: false,
  sourcemap: false,
};

export default defineConfig([
  {
    ...common,
    entry: { copy2llm: "src/index.ts" },
    define: { __C2L_EXTERNAL__: "true" },
    clean: true,
  },
  {
    ...common,
    entry: { "copy2llm.local": "src/index.ts" },
    define: { __C2L_EXTERNAL__: "false" },
    clean: false,
  },
]);
