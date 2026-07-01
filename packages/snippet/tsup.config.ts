import { defineConfig } from "tsup";

// The snippet is injected into other people's pages, so it inlines everything
// (widget + core + Readability + Turndown) into a single minified IIFE.
export default defineConfig({
  entry: { copy2llm: "src/index.ts" },
  format: ["iife"],
  platform: "browser",
  noExternal: [/.*/],
  minify: true,
  treeshake: true,
  dts: false,
  sourcemap: false,
  clean: true,
});
