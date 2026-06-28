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
