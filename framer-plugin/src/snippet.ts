// Pure builder: turns a config into the exact inline <script> tag the Framer
// plugin installs via framer.setCustomCode. The widget code is INLINED (passed
// in by the caller, baked into the plugin bundle at build time) rather than
// loaded from a remote URL — the Marketplace requires the executed code to be
// part of the reviewed plugin and unable to change after publication.
// Kept dependency-free so it unit-tests without the React/widget runtime. The
// data-* names mirror the widget's parseDataset contract (copy2llm-widget/options.ts).

export type Position =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left"
  | "inline";
export type Theme = "auto" | "light" | "dark";
export type Font = "sans" | "serif" | "mono";
// Local-only: the Framer plugin exposes only actions that keep page content on
// the page. No third-party AI targets or custom endpoints are offered, and the
// injected widget bundle (copy2llm.local.global.js) has no code to reach them.
export type Action = "copy" | "view";

export interface SnippetConfig {
  bg?: string;
  content?: string;
  font: Font;
  header: boolean;
  items: Action[];
  label: string;
  position: Position;
  radius: string;
  text?: string;
  theme: Theme;
}

// Boolean attribute stamped on the inline <script> so a re-opened plugin can
// tell our install apart from other custom code (replaces the old src= check).
const SNIPPET_MARKER = "data-copy2llm";
// Installs from before inlining loaded the widget from this URL; still detected
// so existing users can Update/Remove and get migrated to the inline version.
const LEGACY_SRC = "https://copy.computer/copy2llm.js";

export const ALL_ACTIONS: readonly Action[] = ["copy", "view"];

export const DEFAULT_CONFIG: SnippetConfig = {
  position: "bottom-right",
  theme: "auto",
  font: "sans",
  radius: "rounded",
  label: "Copy as Markdown",
  header: true,
  // Copy (clipboard) and View (overlay) both transmit nothing — page content
  // never leaves the site.
  items: ["copy", "view"],
};

// Escape values before they land inside a double-quoted HTML attribute. The
// label is user-controlled and gets injected into the site's markup, so this
// is a trust boundary — `&` first so existing entities aren't double-escaped.
function escapeAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// Self-identifying, versioned header on the injected script, so anyone auditing
// a page's custom code can see what it is, which version, and that it is inlined
// (never fetched), not an anonymous minified blob. The full readable source is
// the open-source copy2llm-snippet package (Mozilla Readability + Turndown do
// the extraction). No URL here to keep the injected code free of any remote ref.
function banner(version: string): string {
  const v = version ? ` v${version}` : "";
  return (
    `/* Copy to LLM widget${v} — MIT, open source. Inlined verbatim into this ` +
    "page; not fetched at runtime, so it cannot change after review. */\n"
  );
}

/**
 * Build the install snippet: an inline <script> carrying the widget `source`
 * (the reviewed, bundled copy2llm IIFE) plus `data-*` for non-default values.
 * The widget reads its config from `document.currentScript.dataset`, which works
 * for inline scripts exactly as it did for the remote one. `version` is stamped
 * into the banner for auditability.
 */
export function buildSnippet(
  config: SnippetConfig,
  source: string,
  version = ""
): string {
  const attrs: string[] = [SNIPPET_MARKER];
  const add = (key: string, value: string) => {
    attrs.push(`data-${key}="${escapeAttr(value)}"`);
  };

  if (config.position !== DEFAULT_CONFIG.position) {
    add("position", config.position);
  }
  if (config.theme !== DEFAULT_CONFIG.theme) {
    add("theme", config.theme);
  }
  if (config.font !== DEFAULT_CONFIG.font) {
    add("font", config.font);
  }
  if (config.radius !== DEFAULT_CONFIG.radius) {
    add("radius", config.radius);
  }
  if (config.label !== DEFAULT_CONFIG.label) {
    add("label", config.label);
  }
  if (config.header === false) {
    add("header", "false");
  }
  // Always emit the enabled actions explicitly, so the published widget matches
  // the plugin's checkboxes exactly.
  add("items", config.items.join(","));
  if (config.bg) {
    add("bg", config.bg);
  }
  if (config.text) {
    add("text", config.text);
  }
  if (config.content) {
    add("content", config.content);
  }

  // Defuse any literal `</script` in the bundle so it can't close the tag early.
  // The current build has none, but the bundle can change — keep the guard.
  const safeSource = source.replace(/<\/script/gi, "<\\/script");
  return `<script ${attrs.join(" ")}>${banner(version)}${safeSource}</script>`;
}

// Comment delimiters wrapping our install inside the (shared) custom-code slot.
// Framer's bodyEnd is a single HTML string that can also hold the site owner's
// own code and other plugins' code, and setCustomCode REPLACES the whole slot —
// so we splice only the text between these markers and leave everything else
// untouched. Kept free of regex-special characters so they match literally.
const MANAGED_START = "<!-- copy2llm:start -->";
const MANAGED_END = "<!-- copy2llm:end -->";
const MANAGED_NOTE =
  "<!-- Managed by the Copy to LLM plugin. Edit it from the plugin, not here. -->";

/** True when custom code at a location is our snippet (for install detection). */
export function isOurSnippet(html: string | null | undefined): boolean {
  return (
    typeof html === "string" &&
    (html.includes(SNIPPET_MARKER) || html.includes(LEGACY_SRC))
  );
}

/**
 * Remove every form of our install from a custom-code slot, leaving any
 * unrelated code (other plugins, the site owner's own code) intact. Handles the
 * marker-wrapped block (current), plus bare installs from older versions: the
 * unwrapped inline `data-copy2llm` script, and the pre-inline remote `<script
 * src=…copy2llm.js>`. Our generated script has every inner `</script` defused,
 * so the first `</script>` after our opening tag is reliably its own close.
 */
export function stripSnippet(html: string | null | undefined): string {
  if (!html) {
    return "";
  }
  return (
    html
      // Marker-wrapped block, including the markers themselves.
      .replace(new RegExp(`${MANAGED_START}[\\s\\S]*?${MANAGED_END}`, "g"), "")
      // Bare inline install from before we wrapped it in markers.
      .replace(/<script[^>]*\bdata-copy2llm\b[^>]*>[\s\S]*?<\/script>/gi, "")
      // Legacy remote install.
      .replace(
        /<script[^>]*src=["']https:\/\/copy\.computer\/copy2llm\.js["'][^>]*>[\s\S]*?<\/script>/gi,
        ""
      )
      // Tidy the blank lines our removal may leave behind.
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * Splice our snippet into an existing custom-code slot: drop any prior install,
 * then append the new one wrapped in markers. Unrelated code is preserved and
 * stays ahead of our block. Returns the full new slot value for setCustomCode.
 */
export function mergeSnippet(
  existing: string | null | undefined,
  snippet: string
): string {
  const rest = stripSnippet(existing);
  const block = `${MANAGED_START}\n${MANAGED_NOTE}\n${snippet}\n${MANAGED_END}`;
  return rest ? `${rest}\n${block}` : block;
}
