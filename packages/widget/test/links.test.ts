import { expect, test } from "bun:test";
import { customLink, llmUrl } from "../src/links";

test("llmUrl: inlines the page Markdown into the chatgpt ?q= prefill", () => {
  const link = llmUrl("chatgpt", "# Title\n\nReal article body.");
  expect(link.href.startsWith("https://chatgpt.com/?q=")).toBe(true);
  expect(link.needsPaste).toBe(false);
  expect(decodeURIComponent(link.href)).toContain("Real article body.");
});

test("llmUrl: claude target uses the claude base", () => {
  const link = llmUrl("claude", "# Title\n\nbody");
  expect(link.href.startsWith("https://claude.ai/new?q=")).toBe(true);
});

test("llmUrl: perplexity and grok targets use their search/?q= bases", () => {
  expect(
    llmUrl("perplexity", "x").href.startsWith(
      "https://www.perplexity.ai/search?q="
    )
  ).toBe(true);
  expect(llmUrl("grok", "x").href.startsWith("https://grok.com/?q=")).toBe(
    true
  );
});

test("customLink: appends the query to a bare base (no placeholder)", () => {
  const link = customLink("https://acme.ai/chat?q=", "# T\n\nbody text");
  expect(link.href.startsWith("https://acme.ai/chat?q=")).toBe(true);
  expect(decodeURIComponent(link.href)).toContain("body text");
  expect(link.needsPaste).toBe(false);
});

test("customLink: substitutes a {q} placeholder mid-URL", () => {
  const link = customLink("https://acme.ai/?p={q}&model=x", "hi");
  expect(link.href).toContain("&model=x");
  expect(decodeURIComponent(link.href)).toContain("hi");
});

test("customLink: too-long page falls back to a clipboard paste", () => {
  const link = customLink("https://acme.ai/?q=", "x".repeat(20_000));
  expect(link.needsPaste).toBe(true);
  expect(decodeURIComponent(link.href).toLowerCase()).toContain("paste");
});

test("llmUrl: a too-long page falls back to a clipboard paste instruction", () => {
  const huge = "x".repeat(20_000);
  const link = llmUrl("chatgpt", huge);
  expect(link.needsPaste).toBe(true);
  const q = decodeURIComponent(link.href);
  expect(q).not.toContain(huge);
  expect(q.toLowerCase()).toContain("paste");
});
