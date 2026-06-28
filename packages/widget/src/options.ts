export type Action = "copy" | "view" | "chatgpt" | "claude";
export type Position =
  | "bottom-right"
  | "bottom-left"
  | "top-right"
  | "top-left"
  | "inline";
export type Theme = "auto" | "light" | "dark";
export type Font = "sans" | "serif" | "mono";

export interface WidgetOptions {
  /** Button background (any CSS color). Default: from theme. */
  bg?: string;
  /** CSS selector for the content root (→ core ExtractOptions.content). */
  content?: string;
  /** System font stack. Default: sans. */
  font?: Font;
  /** Prepend a title + source header (→ core ExtractOptions.header). Default: true. */
  header?: boolean;
  /** Which actions to show, in order. First is the primary button. Default: all. */
  items?: Action[];
  /** Primary button text. Default: "Copy as Markdown". */
  label?: string;
  /** Corner placement, or `inline` to sit in normal flow. Default: bottom-right. */
  position?: Position;
  /** `sharp`/`rounded`/`pill`, or any CSS length. Default: rounded. */
  radius?: string;
  /** Button text color. Default: auto-contrast from `bg`. */
  text?: string;
  /** `auto` matches the host site; `light`/`dark` pin it. Default: auto. */
  theme?: Theme;
}

export const ALL_ACTIONS: readonly Action[] = Object.freeze([
  "copy",
  "view",
  "chatgpt",
  "claude",
]);

export const DEFAULTS = {
  position: "bottom-right",
  theme: "auto",
  font: "sans",
  radius: "rounded",
  header: true,
  label: "Copy as Markdown",
  items: ALL_ACTIONS,
} satisfies {
  position: Position;
  theme: Theme;
  font: Font;
  radius: string;
  header: boolean;
  label: string;
  items: readonly Action[];
};

const POSITIONS = new Set<string>([
  "bottom-right",
  "bottom-left",
  "top-right",
  "top-left",
  "inline",
]);
const THEMES = new Set<string>(["auto", "light", "dark"]);
const FONTS = new Set<string>(["sans", "serif", "mono"]);
const ACTIONS = new Set<string>(ALL_ACTIONS);
const FALSY = /^(?:false|0|off|no)$/i;

/** Parse a `data-*` map (snippet path) into typed options, dropping junk values. */
export function parseDataset(data: DOMStringMap): WidgetOptions {
  const opts: WidgetOptions = {};
  const {
    position,
    theme,
    font,
    bg,
    text,
    radius,
    content,
    label,
    header,
    items,
  } = data;

  if (position && POSITIONS.has(position)) {
    opts.position = position as Position;
  }
  if (theme && THEMES.has(theme)) {
    opts.theme = theme as Theme;
  }
  if (font && FONTS.has(font)) {
    opts.font = font as Font;
  }
  if (bg) {
    opts.bg = bg;
  }
  if (text) {
    opts.text = text;
  }
  if (radius) {
    opts.radius = radius;
  }
  if (content) {
    opts.content = content;
  }
  if (label) {
    opts.label = label;
  }
  if (header !== undefined) {
    opts.header = !FALSY.test(header);
  }
  if (items !== undefined) {
    const parsed = items
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is Action => ACTIONS.has(s));
    if (parsed.length > 0) {
      opts.items = parsed;
    }
  }
  return opts;
}
