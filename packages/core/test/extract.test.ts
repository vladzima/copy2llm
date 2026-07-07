import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { extract } from "../src/index";

function doc(html: string, url = "https://example.com/docs/page") {
  return new JSDOM(html, { url }).window.document;
}

const PAGE =
  "<html><head><title>Doc Title</title></head><body>" +
  "<nav>NAVTEXT</nav>" +
  '<article id="c"><h2>Hello</h2><p>World <a href="/x">link</a></p></article>' +
  "</body></html>";

test("extracts selector content to markdown with header and absolute links", () => {
  const { markdown, title, url } = extract(doc(PAGE), { content: "#c" });
  expect(title).toBe("Doc Title");
  expect(url).toBe("https://example.com/docs/page");
  expect(markdown).toContain("# Doc Title");
  expect(markdown).toContain("> Source: https://example.com/docs/page");
  expect(markdown).toContain("## Hello");
  expect(markdown).toContain("World [link](https://example.com/x)");
  expect(markdown).not.toContain("NAVTEXT");
});

test("header:false omits the frontmatter", () => {
  const d = doc(
    '<html><head><title>T</title></head><body><article id="c"><p>Body</p></article></body></html>'
  );
  expect(extract(d, { content: "#c", header: false }).markdown).toBe("Body");
});

test("prepends the header by default (no header option)", () => {
  const d = doc(
    '<html><head><title>Doc</title></head><body><article id="c"><p>Body</p></article></body></html>'
  );
  expect(extract(d, { content: "#c" }).markdown).toBe(
    "# Doc\n\n> Source: https://example.com/docs/page\n\nBody"
  );
});

test("promotes a data-src lazy image on the selector path", () => {
  const d = doc(
    '<html><head><title>T</title></head><body><div id="c"><img alt="diagram" data-src="/lazy.png"></div></body></html>'
  );
  expect(extract(d, { content: "#c", header: false }).markdown).toBe(
    "![diagram](https://example.com/lazy.png)"
  );
});

const SECTIONED =
  "<html><head><title>Doc Title</title></head><body><main>" +
  '<h2 id="intro">Intro</h2><p>Intro text.</p>' +
  '<h2 id="usage">Usage</h2><p>Usage text with <a href="/y">link</a>.</p>' +
  "</main></body></html>";

test("region: extracts just the picked element and deep-links the source", () => {
  const d = doc(SECTIONED);
  const el = d.querySelectorAll("p")[1] as Element;
  const { markdown, url } = extract(d, { region: el });
  expect(url).toBe("https://example.com/docs/page#usage");
  expect(markdown).toContain("> Source: https://example.com/docs/page#usage");
  expect(markdown).toContain("Usage text with [link](https://example.com/y)");
  expect(markdown).not.toContain("Intro text.");
});

test("region: extracts a partial text selection Range with its section anchor", () => {
  const d = doc(SECTIONED);
  const p = d.querySelectorAll("p")[0] as Element;
  const range = d.createRange();
  range.setStart(p.firstChild as Node, 0);
  range.setEnd(p.firstChild as Node, 5); // "Intro"
  const { markdown, url } = extract(d, { region: range, header: false });
  expect(markdown).toBe("Intro");
  expect(url).toBe("https://example.com/docs/page#intro");
});

test("region: no anchor on the page leaves the source URL bare", () => {
  const d = doc(
    "<html><head><title>T</title></head><body><main><p>Only text.</p></main></body></html>"
  );
  const { markdown, url } = extract(d, {
    region: d.querySelector("p") as Element,
  });
  expect(url).toBe("https://example.com/docs/page");
  expect(markdown).toContain("> Source: https://example.com/docs/page");
});

test("pads ragged table rows into valid GFM", () => {
  const d = doc(
    '<html><head><title>T</title></head><body><div id="c"><table><tr><td>a</td><td>b</td><td>cc</td></tr><tr><td>1</td></tr></table></div></body></html>'
  );
  expect(extract(d, { content: "#c", header: false }).markdown).toBe(
    "| a | b | cc |\n| --- | --- | --- |\n| 1 |  |  |"
  );
});
