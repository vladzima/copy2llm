import type { Position, WidgetOptions } from "./options";
import { contrastText, parseColor, type ResolvedTheme } from "./theme";

export interface StyleTokens {
  bg: string;
  font: string;
  position: Position;
  radius: string;
  text: string;
}

const FONTS: Record<string, string> = {
  sans: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  serif: "Georgia, 'Times New Roman', Times, serif",
  mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
};
const RADIUS: Record<string, string> = {
  sharp: "0",
  rounded: "8px",
  pill: "999px",
};
const THEME_BG: Record<ResolvedTheme, string> = {
  light: "#ffffff",
  dark: "#1a1a1a",
};
const THEME_TEXT: Record<ResolvedTheme, string> = {
  light: "#111111",
  dark: "#f5f5f5",
};

/** Fold options + the resolved theme into concrete CSS values. */
export function resolveTokens(
  options: WidgetOptions,
  theme: ResolvedTheme
): StyleTokens {
  const position = options.position ?? "bottom-right";
  const font = FONTS[options.font ?? "sans"] ?? FONTS.sans;
  const radiusKey = options.radius ?? "rounded";
  const radius = RADIUS[radiusKey] ?? radiusKey;
  const bg = options.bg ?? THEME_BG[theme];
  // Explicit text wins; a parseable explicit bg derives a contrasting text;
  // otherwise (default bg or an unparseable named bg) trust the theme's text.
  let text: string;
  if (options.text) {
    text = options.text;
  } else if (options.bg && parseColor(options.bg)) {
    text = contrastText(options.bg);
  } else {
    text = THEME_TEXT[theme];
  }
  return { position, bg, text, radius, font };
}

function placement(position: Position): string {
  if (position === "inline") {
    return "position: static;";
  }
  const y = position.startsWith("top") ? "top: 16px;" : "bottom: 16px;";
  const x = position.endsWith("left") ? "left: 16px;" : "right: 16px;";
  return `position: fixed; ${y} ${x}`;
}

/** The Shadow-DOM stylesheet. Self-contained; `:host { all: initial }` isolates from the page. */
export function css(t: StyleTokens): string {
  const openUp = t.position.startsWith("bottom");
  const alignRight = t.position.endsWith("right");
  const menuV = openUp
    ? "bottom: 100%; margin-bottom: 6px;"
    : "top: 100%; margin-top: 6px;";
  const menuH = alignRight ? "right: 0;" : "left: 0;";

  return `
:host { all: initial; }
*, *::before, *::after { box-sizing: border-box; }
.root {
  --c2l-bg: ${t.bg};
  --c2l-text: ${t.text};
  --c2l-radius: ${t.radius};
  --c2l-border: color-mix(in srgb, var(--c2l-text) 20%, var(--c2l-bg));
  --c2l-hover: color-mix(in srgb, var(--c2l-text) 9%, var(--c2l-bg));
  ${placement(t.position)}
  z-index: 2147483000;
  font-family: ${t.font};
  font-size: 14px;
  line-height: 1;
  color: var(--c2l-text);
  display: inline-flex;
}
.box { position: relative; display: inline-flex; flex-direction: column; }
.split { display: inline-flex; align-items: stretch; }
.btn {
  font: inherit;
  color: var(--c2l-text);
  background: var(--c2l-bg);
  border: 1px solid var(--c2l-border);
  padding: 8px 12px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.btn:hover { background: var(--c2l-hover); }
.btn:focus-visible { outline: 2px solid var(--c2l-text); outline-offset: 2px; }
.primary { border-radius: var(--c2l-radius) 0 0 var(--c2l-radius); font-weight: 600; }
.caret { border-radius: 0 var(--c2l-radius) var(--c2l-radius) 0; border-left: 0; padding: 8px 10px; }
.split.single .primary { border-radius: var(--c2l-radius); }
.menu {
  position: absolute;
  ${menuV}
  ${menuH}
  min-width: 100%;
  background: var(--c2l-bg);
  border: 1px solid var(--c2l-border);
  border-radius: var(--c2l-radius);
  padding: 4px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
}
.menu[hidden] { display: none; }
.menuitem {
  font: inherit;
  color: var(--c2l-text);
  background: transparent;
  border: 0;
  border-radius: calc(var(--c2l-radius) - 2px);
  padding: 8px 12px;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}
.menuitem:hover, .menuitem:focus-visible { background: var(--c2l-hover); outline: none; }
.toast {
  position: absolute;
  ${openUp ? "bottom: 100%; margin-bottom: 6px;" : "top: 100%; margin-top: 6px;"}
  ${menuH}
  background: var(--c2l-text);
  color: var(--c2l-bg);
  padding: 6px 10px;
  border-radius: var(--c2l-radius);
  font-size: 13px;
  white-space: nowrap;
  pointer-events: none;
}
.toast[hidden] { display: none; }
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 2147483001;
}
.overlay[hidden] { display: none; }
.sheet {
  background: var(--c2l-bg);
  color: var(--c2l-text);
  width: 100%;
  max-width: min(820px, 92vw);
  max-height: 85vh;
  border-radius: var(--c2l-radius);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.35);
}
.sheet header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--c2l-border);
}
.sheet h2 { margin: 0; font-size: 14px; font-weight: 600; }
.sheet .tools { display: inline-flex; gap: 8px; }
.sheet pre {
  margin: 0;
  padding: 16px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
}
`;
}
