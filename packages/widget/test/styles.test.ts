import { expect, test } from "bun:test";
import { css, resolveTokens } from "../src/styles";

test("resolveTokens: light defaults", () => {
  const t = resolveTokens({}, "light");
  expect(t.position).toBe("bottom-right");
  expect(t.bg).toBe("#ffffff");
  expect(t.text).toBe("#111111");
  expect(t.radius).toBe("8px");
  expect(t.font).toContain("system-ui");
});

test("resolveTokens: dark defaults", () => {
  const t = resolveTokens({}, "dark");
  expect(t.bg).toBe("#1a1a1a");
  expect(t.text).toBe("#f5f5f5");
});

test("resolveTokens: explicit bg derives a contrasting text color", () => {
  expect(resolveTokens({ bg: "#000000" }, "light").text).toBe("#ffffff");
  expect(resolveTokens({ bg: "#ffffff" }, "dark").text).toBe("#111111");
});

test("resolveTokens: an unparseable named bg falls back to the theme's text", () => {
  expect(resolveTokens({ bg: "rebeccapurple" }, "dark").text).toBe("#f5f5f5");
});

test("resolveTokens: radius keywords map; a custom length passes through", () => {
  expect(resolveTokens({ radius: "pill" }, "light").radius).toBe("999px");
  expect(resolveTokens({ radius: "sharp" }, "light").radius).toBe("0");
  expect(resolveTokens({ radius: "12px" }, "light").radius).toBe("12px");
});

test("resolveTokens: explicit text overrides derivation", () => {
  expect(resolveTokens({ bg: "#000", text: "red" }, "light").text).toBe("red");
});

test("css: fixed corner placement embeds the tokens", () => {
  const out = css(resolveTokens({ position: "top-left" }, "light"));
  expect(out).toContain("position: fixed");
  expect(out).toContain("top: 16px");
  expect(out).toContain("left: 16px");
  expect(out).toContain("#ffffff");
});

test("css: inline position sits in normal flow", () => {
  const out = css(resolveTokens({ position: "inline" }, "light"));
  expect(out).toContain("position: static");
});

test("css: bottom placement opens the menu upward", () => {
  const out = css(resolveTokens({ position: "bottom-right" }, "light"));
  expect(out).toContain("bottom: 100%");
});
