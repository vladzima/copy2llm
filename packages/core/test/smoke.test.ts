import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";

test("jsdom builds a document", () => {
  const dom = new JSDOM("<!DOCTYPE html><title>Hi</title><body><p>ok</p>");
  expect(dom.window.document.querySelector("p")?.textContent).toBe("ok");
});
