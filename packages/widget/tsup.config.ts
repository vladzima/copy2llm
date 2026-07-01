import { defineConfig } from "tsup";

export default defineConfig([
  // Full library (esm + cjs) — external AI targets included. Used by npm/react.
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
  },
  // Local-only ESM: `__C2L_EXTERNAL__=false` + minify dead-code-eliminates every
  // third-party deep-link path (verified: no external URLs remain). The Framer
  // plugin imports its preview `mount` from here so nothing it bundles can send
  // page content off-site.
  {
    entry: { local: "src/index.ts" },
    format: ["esm"],
    define: { __C2L_EXTERNAL__: "false" },
    minify: true,
    treeshake: true,
    dts: true,
    clean: false,
    sourcemap: false,
  },
]);
