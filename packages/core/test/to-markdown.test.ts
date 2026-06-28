import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { toMarkdown } from "../src/to-markdown";

function node(html: string) {
  return new JSDOM(`<!DOCTYPE html><body>${html}</body>`).window.document.body;
}

test("converts heading + paragraph with collapsed blank lines", () => {
  expect(toMarkdown(node("<h1>Title</h1><p>Hello</p>"))).toBe(
    "# Title\n\nHello"
  );
});

test("converts a GFM table", () => {
  const md = toMarkdown(
    node(
      "<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>"
    )
  );
  expect(md).toContain("| A | B |");
  expect(md).toContain("| 1 | 2 |");
});

test("converts a fenced code block", () => {
  const md = toMarkdown(
    node('<pre><code class="language-js">const x = 1;</code></pre>')
  );
  expect(md).toContain("```");
  expect(md).toContain("const x = 1;");
});

test("converts an unordered list", () => {
  expect(toMarkdown(node("<ul><li>one</li><li>two</li></ul>"))).toBe(
    "-   one\n-   two"
  );
});

test("converts an ordered list", () => {
  expect(toMarkdown(node("<ol><li>one</li><li>two</li></ol>"))).toBe(
    "1.  one\n2.  two"
  );
});
