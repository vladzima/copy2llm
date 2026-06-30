import { describe, expect, test } from "bun:test";
import { buildSnippet, DEFAULT_CONFIG, type SnippetConfig } from "./snippet";

const cfg = (over: Partial<SnippetConfig> = {}): SnippetConfig => ({
  ...DEFAULT_CONFIG,
  ...over,
});

describe("buildSnippet", () => {
  test("emits a bare script tag when every value is default", () => {
    expect(buildSnippet(cfg())).toBe(
      '<script src="https://copy.computer/copy2llm.js" async></script>'
    );
  });

  test("emits data-* only for non-default values", () => {
    const html = buildSnippet(cfg({ position: "top-left", label: "Copy" }));
    expect(html).toContain('data-position="top-left"');
    expect(html).toContain('data-label="Copy"');
    // defaults stay out
    expect(html).not.toContain("data-theme");
    expect(html).not.toContain("data-font");
    expect(html).not.toContain("data-radius");
  });

  test('emits data-header="false" only when the header is turned off', () => {
    expect(buildSnippet(cfg({ header: true }))).not.toContain("data-header");
    expect(buildSnippet(cfg({ header: false }))).toContain(
      'data-header="false"'
    );
  });

  test("emits data-items only for a non-default action set, preserving order", () => {
    expect(buildSnippet(cfg())).not.toContain("data-items");
    expect(buildSnippet(cfg({ items: ["copy", "view"] }))).toContain(
      'data-items="copy,view"'
    );
  });

  test("supports the perplexity and grok built-in actions in items", () => {
    expect(
      buildSnippet(cfg({ items: ["copy", "perplexity", "grok"] }))
    ).toContain('data-items="copy,perplexity,grok"');
  });

  test("emits data-endpoints as a JSON array only when endpoints are set", () => {
    expect(buildSnippet(cfg())).not.toContain("data-endpoints");
    const html = buildSnippet(
      cfg({ endpoints: [{ label: "Acme AI", href: "https://acme.ai/?q={q}" }] })
    );
    // The inner JSON quotes are entity-escaped; the browser decodes them back to
    // valid JSON for the widget's parseDataset.
    expect(html).toContain(
      'data-endpoints="[{&quot;label&quot;:&quot;Acme AI&quot;,&quot;href&quot;:&quot;https://acme.ai/?q={q}&quot;}]"'
    );
  });

  test("drops custom endpoints missing a label or href", () => {
    expect(
      buildSnippet(
        cfg({
          endpoints: [
            { label: "ok", href: "https://x/?q=" },
            { label: "", href: "https://y" },
            { label: "no href", href: "" },
          ],
        })
      )
    ).toContain('data-endpoints="[{&quot;label&quot;:&quot;ok&quot;');
  });

  test("includes optional colors and content only when set", () => {
    const html = buildSnippet(
      cfg({ bg: "#6b62f2", text: "#ffffff", content: "main" })
    );
    expect(html).toContain('data-bg="#6b62f2"');
    expect(html).toContain('data-text="#ffffff"');
    expect(html).toContain('data-content="main"');
  });

  test("escapes HTML-special characters in attribute values", () => {
    const html = buildSnippet(cfg({ label: 'A & B "x" <y>' }));
    expect(html).toContain('data-label="A &amp; B &quot;x&quot; &lt;y&gt;"');
    // the raw, unescaped form must never reach the markup
    expect(html).not.toContain('"x"');
    expect(html).not.toContain("<y>");
  });
});
