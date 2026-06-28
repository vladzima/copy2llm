import { expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

// `framer` only exists inside Framer's runtime — mock it before importing the
// component (which calls addPropertyControls at module-eval time).
const controlCalls: [unknown, Record<string, unknown>][] = [];
mock.module("framer", () => ({
  ControlType: {
    String: "string",
    Boolean: "boolean",
    Enum: "enum",
    Color: "color",
  },
  addPropertyControls: (
    component: unknown,
    controls: Record<string, unknown>
  ) => {
    controlCalls.push([component, controls]);
  },
}));

const { CopyToLLM } = await import("../src/index");

test("registers property controls for every documented knob", () => {
  expect(controlCalls.length).toBe(1);
  const controls = controlCalls[0][1];
  for (const key of [
    "position",
    "theme",
    "bg",
    "text",
    "font",
    "radius",
    "content",
    "header",
    "label",
  ]) {
    expect(controls[key]).toBeDefined();
  }
});

test("renders the inline widget span via the React wrapper", () => {
  expect(renderToStaticMarkup(<CopyToLLM position="inline" />)).toBe(
    "<span></span>"
  );
});
