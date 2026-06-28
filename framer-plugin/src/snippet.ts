// Pure builder: turns a config into the exact <script> tag the Framer plugin
// installs via framer.setCustomCode. Kept dependency-free so it unit-tests
// without the React/widget runtime. The data-* names mirror the widget's
// parseDataset contract (copy2llm-widget/options.ts).

export type Position =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left"
  | "inline";
export type Theme = "auto" | "light" | "dark";
export type Font = "sans" | "serif" | "mono";
export type Action = "copy" | "view" | "chatgpt" | "claude";

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

export const SNIPPET_SRC = "https://copy.computer/copy2llm.js";

export const ALL_ACTIONS: readonly Action[] = [
  "copy",
  "view",
  "chatgpt",
  "claude",
];

export const DEFAULT_CONFIG: SnippetConfig = {
  position: "bottom-right",
  theme: "auto",
  font: "sans",
  radius: "rounded",
  label: "Copy as Markdown",
  header: true,
  items: [...ALL_ACTIONS],
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

/** Build the install snippet, emitting `data-*` only for non-default values. */
export function buildSnippet(config: SnippetConfig): string {
  const attrs: string[] = [`src="${SNIPPET_SRC}"`];
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
  if (config.items.join(",") !== DEFAULT_CONFIG.items.join(",")) {
    add("items", config.items.join(","));
  }
  if (config.bg) {
    add("bg", config.bg);
  }
  if (config.text) {
    add("text", config.text);
  }
  if (config.content) {
    add("content", config.content);
  }

  attrs.push("async");
  return `<script ${attrs.join(" ")}></script>`;
}

/** True when custom code at a location is our snippet (for install detection). */
export function isOurSnippet(html: string | null | undefined): boolean {
  return typeof html === "string" && html.includes(SNIPPET_SRC);
}
