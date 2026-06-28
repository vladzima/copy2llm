import { expect, test } from "bun:test";
import { mount } from "@copy2llm/widget";
import { JSDOM } from "jsdom";
import { renderToStaticMarkup } from "react-dom/server";
import { CopyToLLM } from "../src/index";

test("renders an in-flow anchor span for position=inline", () => {
  expect(renderToStaticMarkup(<CopyToLLM position="inline" />)).toBe(
    "<span></span>"
  );
});

test("renders nothing for a floating (default) position", () => {
  expect(renderToStaticMarkup(<CopyToLLM />)).toBe("");
});

test("mount can target a non-body element — the inline mount path", () => {
  const doc = new JSDOM("<!DOCTYPE html><body></body>", {
    url: "https://example.com/",
  }).window.document;
  const span = doc.createElement("span");
  doc.body.appendChild(span);

  const handle = mount({ position: "inline" }, span);
  expect(span.querySelector("[data-copy2llm]")).not.toBeNull();

  handle.destroy();
  expect(span.querySelector("[data-copy2llm]")).toBeNull();
});
