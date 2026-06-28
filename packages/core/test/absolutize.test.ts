import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { absolutizeUrls } from "../src/absolutize";

function body(html: string, url = "https://example.com/docs/page") {
  return new JSDOM(`<!DOCTYPE html><body>${html}</body>`, { url }).window
    .document.body;
}

test("resolves a root-relative anchor href", () => {
  const root = body('<a href="/about">About</a>');
  absolutizeUrls(root, "https://example.com/docs/page");
  expect(root.querySelector("a")?.getAttribute("href")).toBe(
    "https://example.com/about"
  );
});

test("resolves a relative img src against the page directory", () => {
  const root = body('<img src="../img/logo.png">');
  absolutizeUrls(root, "https://example.com/docs/page");
  expect(root.querySelector("img")?.getAttribute("src")).toBe(
    "https://example.com/img/logo.png"
  );
});

test("leaves already-absolute urls untouched", () => {
  const root = body('<a href="https://other.com/x">x</a>');
  absolutizeUrls(root, "https://example.com/");
  expect(root.querySelector("a")?.getAttribute("href")).toBe(
    "https://other.com/x"
  );
});

test("no-ops when baseUrl is empty", () => {
  const root = body('<a href="/about">About</a>');
  absolutizeUrls(root, "");
  expect(root.querySelector("a")?.getAttribute("href")).toBe("/about");
});
