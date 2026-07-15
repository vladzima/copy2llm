import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import {
  addContextItem,
  buildContextMarkdown,
  CONTEXT_STORAGE_KEY,
  createContextItem,
  estimateTokens,
  loadContext,
  MAX_CONTEXT_CHARACTERS,
  MAX_CONTEXT_ITEMS,
  moveContextItem,
  saveContext,
} from "../src/context";

const source = (
  title: string,
  markdown: string,
  kind: "page" | "selection" | "section" = "page"
) =>
  createContextItem(
    { kind, markdown, title, url: `https://example.com/${title}` },
    title.length
  );

test("adds, deduplicates, and updates a page source in place", () => {
  const first = source("one", "Old body");
  expect(addContextItem([], first).status).toBe("added");
  expect(addContextItem([first], first).status).toBe("duplicate");

  const updated = source("one", "New body");
  const mutation = addContextItem([first, source("two", "Two")], updated);
  expect(mutation.status).toBe("updated");
  expect(mutation.items.map((item) => item.markdown)).toEqual([
    "New body",
    "Two",
  ]);
  expect(mutation.items[0]?.id).toBe(first.id);
});

test("keeps distinct selections from the same page", () => {
  const one = source("same", "First", "selection");
  const two = source("same", "Second", "selection");
  expect(addContextItem([one], two).items).toHaveLength(2);
});

test("enforces source and character limits without dropping existing context", () => {
  const items = Array.from({ length: MAX_CONTEXT_ITEMS }, (_, index) =>
    source(String(index), "x", "section")
  );
  expect(addContextItem(items, source("overflow", "x")).status).toBe("full");
  const huge = source("huge", "x".repeat(MAX_CONTEXT_CHARACTERS + 1));
  expect(addContextItem([], huge)).toEqual({ items: [], status: "full" });
});

test("reorders sources and builds a portable markdown bundle", () => {
  const one = source("One", "First body");
  const two = source("Two", "Second body", "section");
  const moved = moveContextItem([one, two], two.id, -1);
  expect(moved.map((item) => item.title)).toEqual(["Two", "One"]);
  expect(buildContextMarkdown(moved)).toBe(
    "# AI context\n\n## 1. Two\n> Source: https://example.com/Two\n\nSecond body\n\n## 2. One\n> Source: https://example.com/One\n\nFirst body"
  );
  expect(estimateTokens(9)).toBe(3);
});

test("persists valid context in session storage and ignores corrupt data", () => {
  const storage = new JSDOM("", { url: "https://example.com" }).window
    .sessionStorage;
  const items = [source("One", "Body")];
  expect(saveContext(storage, items)).toBe(true);
  expect(loadContext(storage)).toEqual(items);
  storage.setItem(CONTEXT_STORAGE_KEY, "not json");
  expect(loadContext(storage)).toEqual([]);
});
