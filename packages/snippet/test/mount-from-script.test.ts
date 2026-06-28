import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { mountFromScript } from "../src/mount-from-script";

function dom(html: string) {
  const doc = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
    url: "https://example.com/",
  }).window.document;
  // jsdom leaves readyState at "loading"; treat the page as ready by default so
  // the immediate-mount path is exercised. The defer test overrides this.
  Object.defineProperty(doc, "readyState", {
    configurable: true,
    value: "complete",
  });
  return doc;
}

test("mounts a widget configured from the script's data-* attributes", () => {
  const doc = dom('<script id="s" data-items="copy"></script>');
  const script = doc.getElementById("s") as HTMLScriptElement;

  mountFromScript(doc, script);

  const host = doc.body.querySelector("[data-copy2llm]") as HTMLElement;
  expect(host).not.toBeNull();
  // data-items="copy" → a single action → no caret rendered
  expect(host.shadowRoot?.querySelector(".caret")).toBeNull();
});

test("falls back to defaults when there is no script element", () => {
  const doc = dom("");
  mountFromScript(doc, null);
  expect(doc.body.querySelector("[data-copy2llm]")).not.toBeNull();
});

test("defers the mount until DOMContentLoaded when the body is not ready", () => {
  const doc = dom("");
  // Simulate a head script: pretend the body is not available yet.
  Object.defineProperty(doc, "readyState", {
    configurable: true,
    value: "loading",
  });

  mountFromScript(doc, null);
  expect(doc.body.querySelector("[data-copy2llm]")).toBeNull();

  Object.defineProperty(doc, "readyState", {
    configurable: true,
    value: "complete",
  });
  const win = doc.defaultView as unknown as Window & typeof globalThis;
  doc.dispatchEvent(new win.Event("DOMContentLoaded"));
  expect(doc.body.querySelector("[data-copy2llm]")).not.toBeNull();
});
