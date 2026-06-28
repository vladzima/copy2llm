import { expect, test } from "bun:test";
import { isPublicUrl, llmUrl } from "../src/links";

test("isPublicUrl: true for a normal public https URL", () => {
  expect(isPublicUrl("https://example.com/docs/page")).toBe(true);
});

test("isPublicUrl: false for localhost, loopback, LAN ranges, and .local", () => {
  expect(isPublicUrl("http://localhost:3000/")).toBe(false);
  expect(isPublicUrl("http://127.0.0.1/")).toBe(false);
  expect(isPublicUrl("http://192.168.1.10/")).toBe(false);
  expect(isPublicUrl("http://10.0.0.5/")).toBe(false);
  expect(isPublicUrl("http://172.16.0.1/")).toBe(false);
  expect(isPublicUrl("http://my-box.local/")).toBe(false);
});

test("isPublicUrl: false for a single-label intranet host", () => {
  expect(isPublicUrl("http://intranet/")).toBe(false);
});

test("isPublicUrl: false for non-http(s) and unparseable input", () => {
  expect(isPublicUrl("about:blank")).toBe(false);
  expect(isPublicUrl("file:///etc/hosts")).toBe(false);
  expect(isPublicUrl("")).toBe(false);
  expect(isPublicUrl("not a url")).toBe(false);
});

test("llmUrl: a public page embeds the page URL in the q param", () => {
  const url = llmUrl("chatgpt", "https://example.com/p", true);
  expect(url.startsWith("https://chatgpt.com/?q=")).toBe(true);
  expect(decodeURIComponent(url)).toContain("https://example.com/p");
});

test("llmUrl: claude target uses the claude base", () => {
  expect(
    llmUrl("claude", "https://example.com/p", true).startsWith(
      "https://claude.ai/new?q="
    )
  ).toBe(true);
});

test("llmUrl: a non-public page omits the URL and points at the clipboard", () => {
  const url = llmUrl("chatgpt", "http://localhost/p", false);
  const q = decodeURIComponent(url);
  expect(q).not.toContain("localhost");
  expect(q.toLowerCase()).toContain("paste");
});

test("isPublicUrl: false for *.localhost, trailing-dot localhost, and 0.0.0.0 / 0", () => {
  expect(isPublicUrl("http://app.localhost:3000/admin?token=secret")).toBe(
    false
  );
  expect(isPublicUrl("http://localhost./")).toBe(false);
  expect(isPublicUrl("http://0.0.0.0:8080/")).toBe(false);
  expect(isPublicUrl("http://0/")).toBe(false);
});

test("isPublicUrl: a real public host with a trailing dot is still public", () => {
  expect(isPublicUrl("https://example.com./docs")).toBe(true);
});
