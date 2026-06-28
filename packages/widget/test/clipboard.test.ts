import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { copyText } from "../src/clipboard";

type Any = any;

function makeWindow(): Window & typeof globalThis {
  return new JSDOM("<!DOCTYPE html><body></body>").window as Any;
}

test("uses navigator.clipboard.writeText when available", async () => {
  const win = makeWindow();
  let written = "";
  (win.navigator as Any).clipboard = {
    writeText: (t: string) => {
      written = t;
      return Promise.resolve();
    },
  };
  expect(await copyText("hello", win)).toBe(true);
  expect(written).toBe("hello");
});

test("falls back to a hidden textarea + execCommand when the API is missing", async () => {
  const win = makeWindow();
  let copied: string | null = null;
  (win.document as Any).execCommand = () => {
    copied = win.document.querySelector("textarea")?.value ?? null;
    return true;
  };
  expect(await copyText("fallback text", win)).toBe(true);
  expect(copied).toBe("fallback text");
  // textarea is removed afterwards
  expect(win.document.querySelector("textarea")).toBeNull();
});

test("returns false when writeText rejects and execCommand also fails", async () => {
  const win = makeWindow();
  (win.navigator as Any).clipboard = {
    writeText: () => Promise.reject(new Error("blocked")),
  };
  (win.document as Any).execCommand = () => false;
  expect(await copyText("x", win)).toBe(false);
});
