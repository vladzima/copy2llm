import { expect, test } from "bun:test";
import { prependHeader } from "../src/header";

test("prepends title and source", () => {
  expect(prependHeader("Body.", "My Page", "https://x.com/p")).toBe(
    "# My Page\n\n> Source: https://x.com/p\n\nBody."
  );
});

test("omits the title line when title is empty", () => {
  expect(prependHeader("Body.", "", "https://x.com/p")).toBe(
    "> Source: https://x.com/p\n\nBody."
  );
});

test("returns the body unchanged when nothing to prepend", () => {
  expect(prependHeader("Body.", "", "")).toBe("Body.");
});

test("returns only the header when the body is empty", () => {
  expect(prependHeader("", "T", "https://x.com/p")).toBe(
    "# T\n\n> Source: https://x.com/p"
  );
});
