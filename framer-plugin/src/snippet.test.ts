import { describe, expect, test } from "bun:test";
import {
  ALL_ACTIONS,
  buildSnippet,
  DEFAULT_CONFIG,
  isOurSnippet,
  mergeSnippet,
  type SnippetConfig,
  stripSnippet,
} from "./snippet";

// Stand-in for the bundled widget IIFE; the builder treats it as opaque text.
const SRC = "/* widget */";
const build = (over: Partial<SnippetConfig> = {}, source = SRC) =>
  buildSnippet({ ...DEFAULT_CONFIG, ...over }, source);

describe("buildSnippet", () => {
  test("inlines the widget source in a marked, src-less script tag", () => {
    const html = build();
    expect(
      html.startsWith('<script data-copy2llm data-items="copy,view">')
    ).toBe(true);
    expect(html).toContain("/* widget */");
    expect(html.endsWith("</script>")).toBe(true);
  });

  test("prepends a self-identifying banner to the injected script", () => {
    expect(build()).toContain("Copy to LLM widget");
    expect(build()).toContain("not fetched at runtime");
  });

  test("stamps the version into the banner when given", () => {
    expect(buildSnippet(DEFAULT_CONFIG, SRC, "1.2.3")).toContain(
      "Copy to LLM widget v1.2.3"
    );
  });

  test("never references a remote URL — the code is inlined, not fetched", () => {
    expect(build()).not.toContain("src=");
    expect(build()).not.toContain("http");
  });

  test("local-only: no third-party AI target is ever emitted", () => {
    expect(ALL_ACTIONS).toEqual(["copy", "view"]);
    const html = build();
    for (const brand of ["chatgpt", "claude", "perplexity", "grok"]) {
      expect(html).not.toContain(brand);
    }
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
    expect(html).not.toContain("data-theme");
    expect(html).not.toContain("data-font");
    expect(html).not.toContain("data-radius");
  });

  test('emits data-header="false" only when the header is turned off', () => {
    expect(build({ header: true })).not.toContain("data-header");
    expect(build({ header: false })).toContain('data-header="false"');
  });

  test("always emits the enabled actions", () => {
    expect(build()).toContain('data-items="copy,view"');
    expect(build({ items: ["copy"] })).toContain('data-items="copy"');
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

const OTHER = '<script src="https://analytics.example/a.js"></script>';

describe("mergeSnippet / stripSnippet — preserve unrelated custom code", () => {
  test("merge into an empty slot is just our wrapped block", () => {
    const merged = mergeSnippet(null, build());
    expect(merged).toContain("<!-- copy2llm:start -->");
    expect(merged).toContain("<!-- copy2llm:end -->");
    expect(isOurSnippet(merged)).toBe(true);
  });

  test("merge keeps the site owner's existing code ahead of our block", () => {
    const merged = mergeSnippet(OTHER, build());
    expect(merged).toContain(OTHER);
    expect(merged.indexOf(OTHER)).toBeLessThan(merged.indexOf("data-copy2llm"));
  });

  test("re-installing replaces our block in place, never duplicates it", () => {
    const once = mergeSnippet(OTHER, build());
    const twice = mergeSnippet(once, build({ label: "Copy" }));
    expect(twice.match(/<!-- copy2llm:start -->/g)).toHaveLength(1);
    expect(twice.match(/data-copy2llm/g)).toHaveLength(1);
    expect(twice.split(OTHER)).toHaveLength(2);
    expect(twice).toContain('data-label="Copy"');
  });

  test("strip removes our block and leaves unrelated code intact", () => {
    const merged = mergeSnippet(OTHER, build());
    expect(stripSnippet(merged)).toBe(OTHER);
  });

  test("strip of a slot holding only our install yields an empty string", () => {
    expect(stripSnippet(mergeSnippet(null, build()))).toBe("");
  });

  test("strip removes a bare (un-wrapped) inline install from older versions", () => {
    const bare = `${OTHER}\n${build()}`;
    expect(stripSnippet(bare)).toBe(OTHER);
  });

  test("strip removes the legacy remote install", () => {
    const legacy = `${OTHER}\n<script src="https://copy.computer/copy2llm.js" async></script>`;
    expect(stripSnippet(legacy)).toBe(OTHER);
  });

  test("strip leaves a slot with no install of ours untouched", () => {
    expect(stripSnippet(OTHER)).toBe(OTHER);
  });
});
