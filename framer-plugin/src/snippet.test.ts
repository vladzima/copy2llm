import { describe, expect, test } from "bun:test";
import {
  buildSnippet,
  DEFAULT_CONFIG,
  isOurSnippet,
  type SnippetConfig,
} from "./snippet";

// Stand-in for the bundled widget IIFE; the builder treats it as opaque text.
const SRC = "/* widget */";
const build = (over: Partial<SnippetConfig> = {}, source = SRC) =>
  buildSnippet({ ...DEFAULT_CONFIG, ...over }, source);

describe("buildSnippet", () => {
  test("inlines the widget source in a marked, src-less script tag", () => {
    expect(build()).toBe("<script data-copy2llm>/* widget */</script>");
  });

  test("never references a remote URL — the code is inlined, not fetched", () => {
    expect(build()).not.toContain("src=");
    expect(build()).not.toContain("http");
  });

  test("escapes a literal </script in the source so it can't close the tag", () => {
    const html = build({}, 'a("</script>")');
    expect(html).toContain('a("<\\/script>")');
    expect(html).not.toContain("</script>a"); // no premature close
  });

  test("emits data-* only for non-default values", () => {
    const html = build({ position: "top-left", label: "Copy" });
    expect(html).toContain('data-position="top-left"');
    expect(html).toContain('data-label="Copy"');
    // defaults stay out
    expect(html).not.toContain("data-theme");
    expect(html).not.toContain("data-font");
    expect(html).not.toContain("data-radius");
  });

  test('emits data-header="false" only when the header is turned off', () => {
    expect(build({ header: true })).not.toContain("data-header");
    expect(build({ header: false })).toContain('data-header="false"');
  });

  test("emits data-items only for a non-default action set, preserving order", () => {
    expect(build()).not.toContain("data-items");
    expect(build({ items: ["copy", "view"] })).toContain(
      'data-items="copy,view"'
    );
  });

  test("supports the perplexity and grok built-in actions in items", () => {
    expect(build({ items: ["copy", "perplexity", "grok"] })).toContain(
      'data-items="copy,perplexity,grok"'
    );
  });

  test("emits data-endpoints as a JSON array only when endpoints are set", () => {
    expect(build()).not.toContain("data-endpoints");
    const html = build({
      endpoints: [{ label: "Acme AI", href: "https://acme.ai/?q={q}" }],
    });
    // The inner JSON quotes are entity-escaped; the browser decodes them back to
    // valid JSON for the widget's parseDataset.
    expect(html).toContain(
      'data-endpoints="[{&quot;label&quot;:&quot;Acme AI&quot;,&quot;href&quot;:&quot;https://acme.ai/?q={q}&quot;}]"'
    );
  });

  test("drops custom endpoints missing a label or href", () => {
    expect(
      build({
        endpoints: [
          { label: "ok", href: "https://x/?q=" },
          { label: "", href: "https://y" },
          { label: "no href", href: "" },
        ],
      })
    ).toContain('data-endpoints="[{&quot;label&quot;:&quot;ok&quot;');
  });

  test("includes optional colors and content only when set", () => {
    const html = build({ bg: "#6b62f2", text: "#ffffff", content: "main" });
    expect(html).toContain('data-bg="#6b62f2"');
    expect(html).toContain('data-text="#ffffff"');
    expect(html).toContain('data-content="main"');
  });

  test("escapes HTML-special characters in attribute values", () => {
    const html = build({ label: 'A & B "x" <y>' });
    expect(html).toContain('data-label="A &amp; B &quot;x&quot; &lt;y&gt;"');
    // the raw, unescaped form must never reach the markup
    expect(html).not.toContain('"x"');
    expect(html).not.toContain("<y>");
  });
});

describe("isOurSnippet", () => {
  test("recognizes a freshly built inline install", () => {
    expect(isOurSnippet(build())).toBe(true);
  });

  test("still recognizes a pre-inline install loaded from the old URL", () => {
    expect(
      isOurSnippet(
        '<script src="https://copy.computer/copy2llm.js" async></script>'
      )
    ).toBe(true);
  });

  test("ignores unrelated custom code and empty slots", () => {
    expect(
      isOurSnippet('<script src="https://other.example/x.js"></script>')
    ).toBe(false);
    expect(isOurSnippet(null)).toBe(false);
    expect(isOurSnippet(undefined)).toBe(false);
  });
});
