import { expect, test } from "bun:test";
import { llmUrl } from "../src/links";

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

test("llmUrl: a too-long page falls back to a clipboard paste instruction", () => {
  const huge = "x".repeat(20_000);
  const link = llmUrl("chatgpt", huge);
  expect(link.needsPaste).toBe(true);
  const q = decodeURIComponent(link.href);
  expect(q).not.toContain(huge);
  expect(q.toLowerCase()).toContain("paste");
});
