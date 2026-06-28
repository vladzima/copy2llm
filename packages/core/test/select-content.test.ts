import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { selectContent } from "../src/select-content";

function doc(html: string, url = "https://example.com/") {
  return new JSDOM(html, { url }).window.document;
}

test("an explicit selector wins over everything else", () => {
  const d = doc(
    '<html><head><title>T</title></head><body><nav>NAVTEXT</nav><section id="main"><p>PICKED</p></section></body></html>'
  );
  const { root, title } = selectContent(d, "#main");
  expect(root.textContent).toContain("PICKED");
  expect(root.textContent).not.toContain("NAVTEXT");
  expect(title).toBe("T");
});

test("extracts the main content when no selector is given", () => {
  // Behaviour assertion: content survives whether Readability or the <main> fallback produced it.
  const d = doc(
    "<html><head><title>T</title></head><body><main><p>MAIN CONTENT</p></main></body></html>"
  );
  const { root } = selectContent(d);
  expect(root.textContent).toContain("MAIN CONTENT");
});

test("Readability auto-detects loose content when no selector is given", () => {
  // This input is rich enough that Readability returns content (it does NOT
  // exercise the main/article/body fallback — see the dedicated tests below).
  const d = doc(
    "<html><head><title>T</title></head><body><div><p>LOOSE</p></div></body></html>"
  );
  const { root } = selectContent(d);
  expect(root.textContent).toContain("LOOSE");
});

// Empty/whitespace-only element bodies make Readability return null, which is
// the only way to reach the main -> article -> body fallback chain.
test("F5: fallback prefers <main> over <article>", () => {
  const d = doc(
    "<html><head><title>T</title></head><body><article></article><main></main></body></html>"
  );
  const { root } = selectContent(d);
  expect(root.tagName).toBe("MAIN");
});

test("F5: fallback uses <article> when there is no <main>", () => {
  const d = doc(
    "<html><head><title>T</title></head><body><article></article></body></html>"
  );
  const { root } = selectContent(d);
  expect(root.tagName).toBe("ARTICLE");
});

test("F5: fallback uses <body> when there is no main/article", () => {
  const d = doc("<html><head><title>T</title></head><body>   </body></html>");
  const { root } = selectContent(d);
  expect(root.tagName).toBe("BODY");
});

test("F4: a document with no <body> returns an empty root instead of throwing", () => {
  const d = new JSDOM("<root><a>x</a></root>", {
    contentType: "application/xml",
  }).window.document;
  expect(d.body).toBeNull();
  expect(() => selectContent(d)).not.toThrow();
  const { root } = selectContent(d);
  expect(root.textContent).toBe("");
});
