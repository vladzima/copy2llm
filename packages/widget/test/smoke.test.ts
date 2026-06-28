import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";

test("jsdom supports attachShadow", () => {
  const { document } = new JSDOM("<!DOCTYPE html><body></body>").window;
  const host = document.createElement("div");
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = "<button>ok</button>";
  expect(root.querySelector("button")?.textContent).toBe("ok");
});
