import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { DEFAULTS, parseDataset } from "../src/options";

function dataset(attrs: Record<string, string>): DOMStringMap {
  const { document } = new JSDOM("<!DOCTYPE html><body></body>").window;
  const el = document.createElement("div");
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el.dataset;
}

test("defaults: bottom-right, auto theme, all four items", () => {
  expect(DEFAULTS.position).toBe("bottom-right");
  expect(DEFAULTS.theme).toBe("auto");
  expect(DEFAULTS.font).toBe("sans");
  expect(DEFAULTS.radius).toBe("rounded");
  expect(DEFAULTS.header).toBe(true);
  expect(DEFAULTS.items).toEqual(["copy", "view", "chatgpt", "claude"]);
});

test("parseDataset reads known knobs", () => {
  const opts = parseDataset(
    dataset({
      "data-position": "top-left",
      "data-theme": "dark",
      "data-bg": "#0a0a0a",
      "data-font": "mono",
      "data-radius": "pill",
      "data-content": "main#docs",
      "data-label": "Copy MD",
    })
  );
  expect(opts.position).toBe("top-left");
  expect(opts.theme).toBe("dark");
  expect(opts.bg).toBe("#0a0a0a");
  expect(opts.font).toBe("mono");
  expect(opts.radius).toBe("pill");
  expect(opts.content).toBe("main#docs");
  expect(opts.label).toBe("Copy MD");
});

test("parseDataset parses header=false and a comma list of items", () => {
  const opts = parseDataset(
    dataset({ "data-header": "false", "data-items": "copy, chatgpt" })
  );
  expect(opts.header).toBe(false);
  expect(opts.items).toEqual(["copy", "chatgpt"]);
});

test("parseDataset drops unknown enum values and unknown items", () => {
  const opts = parseDataset(
    dataset({
      "data-position": "sideways",
      "data-theme": "neon",
      "data-items": "copy, nope, claude",
    })
  );
  expect(opts.position).toBeUndefined();
  expect(opts.theme).toBeUndefined();
  expect(opts.items).toEqual(["copy", "claude"]);
});

test("parseDataset returns an empty object when nothing is set", () => {
  expect(parseDataset(dataset({}))).toEqual({});
});
