import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import {
  contrastText,
  parseColor,
  resolveTheme,
  resolveThemeSignal,
  watchTheme,
} from "../src/theme";

type Any = any;

function setup() {
  const jd = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  const win = jd.window as unknown as Window & typeof globalThis;
  const host = win.document.createElement("div");
  win.document.body.appendChild(host);
  return { win, host };
}

test("parseColor handles hex and rgb forms", () => {
  expect(parseColor("#fff")).toEqual([255, 255, 255, 1]);
  expect(parseColor("#0a0a0a")).toEqual([10, 10, 10, 1]);
  expect(parseColor("rgb(10, 20, 30)")).toEqual([10, 20, 30, 1]);
  expect(parseColor("rgba(0, 0, 0, 0)")).toEqual([0, 0, 0, 0]);
  expect(parseColor("rebeccapurple")).toBeNull();
});

test("contrastText: dark text on light bg, light text on dark bg", () => {
  expect(contrastText("#ffffff")).toBe("#111111");
  expect(contrastText("#0a0a0a")).toBe("#ffffff");
});

test("resolveTheme: pinned light/dark short-circuits the cascade", () => {
  const { win, host } = setup();
  expect(resolveTheme("dark", host, win)).toBe("dark");
  expect(resolveTheme("light", host, win)).toBe("light");
});

test("resolveTheme auto: :root color-scheme wins first", () => {
  const { win, host } = setup();
  win.document.documentElement.style.colorScheme = "dark";
  expect(resolveTheme("auto", host, win)).toBe("dark");
  win.document.documentElement.style.colorScheme = "light";
  expect(resolveTheme("auto", host, win)).toBe("light");
});

test("resolveTheme auto: background luminance sample is second", () => {
  const { win, host } = setup();
  host.style.backgroundColor = "rgb(10, 10, 10)";
  expect(resolveTheme("auto", host, win)).toBe("dark");
  host.style.backgroundColor = "rgb(245, 245, 245)";
  expect(resolveTheme("auto", host, win)).toBe("light");
});

test("resolveTheme auto: falls back to prefers-color-scheme", () => {
  const { win, host } = setup();
  (win as Any).matchMedia = (q: string) => ({
    matches: q.includes("dark"),
    addEventListener() {
      /* noop */
    },
    removeEventListener() {
      /* noop */
    },
  });
  expect(resolveTheme("auto", host, win)).toBe("dark");
});

test("resolveThemeSignal: null when only prefers-color-scheme could decide", () => {
  const { win, host } = setup();
  // No :root color-scheme, transparent backgrounds → no confident signal yet.
  expect(resolveThemeSignal(host, win)).toBeNull();
});

test("resolveThemeSignal: concrete theme from an opaque background", () => {
  const { win, host } = setup();
  host.style.backgroundColor = "rgb(10, 10, 10)";
  expect(resolveThemeSignal(host, win)).toBe("dark");
  host.style.backgroundColor = "rgb(245, 245, 245)";
  expect(resolveThemeSignal(host, win)).toBe("light");
});

test("resolveThemeSignal: concrete theme from :root color-scheme", () => {
  const { win, host } = setup();
  win.document.documentElement.style.colorScheme = "dark";
  expect(resolveThemeSignal(host, win)).toBe("dark");
});

test("watchTheme: pinned theme never fires and returns a callable cleanup", () => {
  const { win, host } = setup();
  let calls = 0;
  const stop = watchTheme("light", host, win, () => {
    calls++;
  });
  stop();
  expect(calls).toBe(0);
});

test("watchTheme auto: re-resolves when prefers-color-scheme flips", () => {
  const { win, host } = setup();
  let listener: (() => void) | null = null;
  const mql = {
    matches: false,
    addEventListener: (_t: string, cb: () => void) => {
      listener = cb;
    },
    removeEventListener: () => {
      listener = null;
    },
  };
  (win as Any).matchMedia = () => mql;

  const seen: string[] = [];
  const stop = watchTheme("auto", host, win, (t) => seen.push(t));

  mql.matches = true;
  listener?.();
  expect(seen).toEqual(["dark"]);

  stop();
  expect(listener).toBeNull(); // listener removed on cleanup
});

test("watchTheme auto: re-resolves when <html> class mutates", async () => {
  const { win, host } = setup();
  host.style.backgroundColor = "rgb(245, 245, 245)"; // start light
  const seen: string[] = [];
  const stop = watchTheme("auto", host, win, (t) => seen.push(t));

  host.style.backgroundColor = "rgb(10, 10, 10)"; // becomes dark
  win.document.documentElement.className = "theme-dark"; // trigger the observer
  await new Promise((r) => setTimeout(r, 0));

  expect(seen).toContain("dark");
  stop();
});

test("watchTheme auto: does not fire when a mutation leaves the theme unchanged", async () => {
  const { win, host } = setup();
  host.style.backgroundColor = "rgb(245, 245, 245)"; // light
  const seen: string[] = [];
  const stop = watchTheme("auto", host, win, (t) => seen.push(t));

  win.document.documentElement.className = "scroll-progress-42"; // theme stays light
  await new Promise((r) => setTimeout(r, 0));

  expect(seen).toEqual([]);
  stop();
});

test("watchTheme auto: re-resolves on a <body> mutation (body-class dark mode)", async () => {
  const { win, host } = setup();
  host.style.backgroundColor = "rgb(245, 245, 245)"; // light start
  const seen: string[] = [];
  const stop = watchTheme("auto", host, win, (t) => seen.push(t));

  host.style.backgroundColor = "rgb(10, 10, 10)"; // becomes dark
  win.document.body.className = "dark"; // mutate BODY, not <html>
  await new Promise((r) => setTimeout(r, 0));

  expect(seen).toContain("dark");
  stop();
});

test("resolveTheme auto: a near-transparent layer is skipped for the opaque backdrop", () => {
  const { win, host } = setup();
  host.style.backgroundColor = "rgba(255, 255, 255, 0.04)"; // faint tint
  win.document.body.style.backgroundColor = "rgb(10, 10, 10)"; // real backdrop
  expect(resolveTheme("auto", host, win)).toBe("dark");
});
