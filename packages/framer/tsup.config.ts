import { defineConfig } from "tsup";

// Ship one self-contained ESM file: inline our own packages, leave react and
// framer to Framer's runtime.
export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["esm"],
  external: ["react", "react/jsx-runtime", "framer"],
  noExternal: [/@copy2llm\//],
  dts: true,
  clean: true,
  sourcemap: true,
});
