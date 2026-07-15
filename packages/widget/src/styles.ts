import type { Position, WidgetOptions } from "./options";
import { contrastText, parseColor, type ResolvedTheme } from "./theme";

export interface StyleTokens {
  bg: string;
  border: string;
  font: string;
  hover: string;
  itemRadius: string;
  menuRadius: string;
  position: Position;
  radius: string;
  surface: string;
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

/**
 * Linearly mix `weightA` of color A into B, as plain rgb. Returns null if either
 * color isn't parseable (named colors), so the caller can fall back to color-mix.
 * Precomputing avoids `color-mix()`, which is unsupported before ~2023 browsers.
 */
function mix(colorA: string, colorB: string, weightA: number): string | null {
  const a = parseColor(colorA);
  const b = parseColor(colorB);
  if (!(a && b)) {
    return null;
  }
  const ch = (i: number) => Math.round(a[i] * weightA + b[i] * (1 - weightA));
  return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`;
}

/** Translucent `color` for the frosted menu, or null for unparseable named colors. */
function rgba(color: string, alpha: number): string | null {
  const c = parseColor(color);
  return c ? `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${alpha})` : null;
}

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
  const border = mix(text, bg, 0.2) ?? `color-mix(in srgb, ${text} 20%, ${bg})`;
  const hover = mix(text, bg, 0.09) ?? `color-mix(in srgb, ${text} 9%, ${bg})`;
  // Frosted menu surface (slightly translucent over a blur); falls back to the
  // solid bg when the color can't be parsed.
  const surface = rgba(bg, 0.86) ?? bg;
  const sharp = radiusKey === "sharp";
  const menuRadius = sharp ? "6px" : "16px";
  const itemRadius = sharp ? "4px" : "10px";
  return {
    position,
    bg,
    text,
    radius,
    menuRadius,
    itemRadius,
    surface,
    font,
    border,
    hover,
  };
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
  --c2l-menu-radius: ${t.menuRadius};
  --c2l-item-radius: ${t.itemRadius};
  --c2l-border: ${t.border};
  --c2l-hover: ${t.hover};
  --c2l-surface: ${t.surface};
  ${placement(t.position)}
  z-index: 2147483000;
  font-family: ${t.font};
  font-size: 14px;
  line-height: 1;
  color: var(--c2l-text);
  display: inline-flex;
  /* host uses all:initial, which drops smoothing and renders system fonts
     heavy; restore it so labels read closer to a designed UI font. */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  /* Reveal-gated: the button mounts at opacity 0 (no transition here, or the
     initial hide would animate 1→0 and briefly show a wrong-theme button) and
     only fades in once mount() has a confident theme — see the .c2l-in rule. */
  opacity: 0;
}
/* Transitions live ONLY under .c2l-in, so the first paint (still hidden) applies
   the resolved theme instantly — no native-button → theme cross-fade. After
   reveal, opacity fades in and later theme flips cross-fade smoothly. */
.root.c2l-in { opacity: 1; transition: opacity 0.18s ease; }
.root.c2l-in .btn {
  transition: background-color 0.18s ease, color 0.18s ease,
    border-color 0.18s ease;
}
.root.c2l-in .menuitem {
  transition: background-color 0.18s ease, color 0.18s ease;
}
.box { position: relative; display: inline-flex; flex-direction: column; }
.split {
  display: inline-flex;
  align-items: stretch;
  border-radius: var(--c2l-radius);
  box-shadow: 0 6px 22px rgba(0, 0, 0, 0.16);
}
.context-status {
  align-self: ${alignRight ? "flex-end" : "flex-start"};
  order: ${openUp ? "-1" : "1"};
  ${openUp ? "margin-bottom: 6px;" : "margin-top: 6px;"}
  padding: 6px 9px;
  border-radius: 7px;
  background: var(--c2l-surface);
  box-shadow: 0 5px 16px rgba(0, 0, 0, 0.14);
  font-size: 12px;
  font-weight: 500;
}
.context-status[hidden] { display: none; }
.btn {
  font: inherit;
  color: var(--c2l-text);
  background: var(--c2l-bg);
  border: 1px solid var(--c2l-border);
  padding: 9px 13px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.btn:hover { background: var(--c2l-hover); }
.btn:focus-visible { outline: 2px solid var(--c2l-text); outline-offset: 2px; }
.primary { border-radius: var(--c2l-radius) 0 0 var(--c2l-radius); font-weight: 400; }
/* Copy confirmation: the icon + label settle in with a quick upward pop. The
   class is re-applied per swap (see widget.ts) to restart the keyframe. */
@keyframes c2l-swap-in {
  0% { opacity: 0; transform: translateY(-5px) scale(0.96); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
.primary.c2l-swap .c2l-ic,
.primary.c2l-swap .c2l-label {
  animation: c2l-swap-in 0.2s cubic-bezier(0.2, 0.75, 0.2, 1) both;
}
.caret { border-radius: 0 var(--c2l-radius) var(--c2l-radius) 0; border-left: 0; padding: 9px 9px; }
.split.single .primary { border-radius: var(--c2l-radius); }
.c2l-ic { width: 16px; height: 16px; flex: 0 0 auto; fill: currentColor; }
.primary .c2l-ic { opacity: 0.92; }
.caret .c2l-ic { width: 13px; height: 13px; opacity: 0.7; }
.c2l-label { flex: 1 1 auto; text-align: left; }
.c2l-ext {
  width: 13px;
  height: 13px;
  flex: 0 0 auto;
  margin-left: auto;
  fill: currentColor;
  opacity: 0.5;
}
.menu {
  position: absolute;
  ${menuV}
  ${menuH}
  min-width: 212px;
  background: var(--c2l-surface);
  -webkit-backdrop-filter: blur(18px) saturate(165%);
  backdrop-filter: blur(18px) saturate(165%);
  border: 1px solid var(--c2l-border);
  border-radius: var(--c2l-menu-radius);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  box-shadow:
    0 16px 40px rgba(0, 0, 0, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.07);
}
.menu[hidden] { display: none; }
.menuitem {
  font: inherit;
  color: var(--c2l-text);
  background: transparent;
  border: 0;
  border-radius: var(--c2l-item-radius);
  padding: 9px 11px;
  display: flex;
  align-items: center;
  gap: 11px;
  text-align: left;
  white-space: nowrap;
  cursor: pointer;
}
.menuitem .c2l-ic { opacity: 0.85; }
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
  background: rgba(8, 8, 8, 0.62);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 2147483001;
}
.overlay[hidden] { display: none; }
/* The sheet keeps a fixed radius — it must not inherit a pill/sharp button shape. */
.sheet {
  background: var(--c2l-bg);
  color: var(--c2l-text);
  width: 100%;
  max-width: min(760px, 92vw);
  max-height: 84vh;
  border: 1px solid var(--c2l-border);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
}
.sheet header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 13px 13px 18px;
  border-bottom: 1px solid var(--c2l-border);
}
.sheet h2 {
  flex: 1 1 auto;
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: -0.01em;
}
.sheet .tools { display: inline-flex; gap: 8px; }
.sheet .tools .btn {
  height: 32px;
  padding: 0 14px;
  gap: 6px;
  font-size: 13px;
  font-weight: 500;
  border-radius: 8px;
}
.sheet .ov-copy {
  color: var(--c2l-bg);
  background: var(--c2l-text);
  border-color: var(--c2l-text);
}
.sheet .ov-copy:hover { background: var(--c2l-text); opacity: 0.85; }
.sheet .ov-close {
  color: var(--c2l-text);
  background: transparent;
  border-color: var(--c2l-border);
}
.sheet .ov-close:hover { background: var(--c2l-hover); }
.sheet pre {
  margin: 0;
  padding: 18px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.55;
  color: var(--c2l-text);
}
.context-sheet { max-width: min(720px, 92vw); }
.context-sheet header { align-items: flex-start; }
.context-heading { flex: 1 1 auto; min-width: 0; }
.context-heading h2 { margin-bottom: 5px; }
.context-summary {
  margin: 0;
  color: var(--c2l-text);
  font-size: 12px;
  line-height: 1.35;
  opacity: 0.62;
}
.context-close,
.context-footer-row .btn {
  min-height: 32px;
  padding: 7px 11px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  gap: 7px;
}
.context-footer-row .c2l-ic { width: 14px; height: 14px; opacity: 0.82; }
.context-close { background: transparent; }
.context-body { min-height: 180px; overflow: auto; }
.context-empty {
  min-height: 180px;
  padding: 32px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 7px;
  text-align: center;
}
.context-empty[hidden] { display: none; }
.context-empty strong { font-size: 14px; font-weight: 550; }
.context-empty span { font-size: 12px; opacity: 0.62; }
.context-list { list-style: none; margin: 0; padding: 0; }
.context-list[hidden] { display: none; }
.context-source {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 66px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--c2l-border);
}
.context-source:last-child { border-bottom: 0; }
.context-source-info {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.context-source-info strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 550;
  line-height: 1.25;
}
.context-source-info span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  line-height: 1.3;
  opacity: 0.58;
}
.context-source-controls { display: inline-flex; align-items: center; gap: 3px; }
.context-source-action {
  min-width: 27px;
  height: 27px;
  padding: 0 7px;
  color: var(--c2l-text);
  background: transparent;
  border: 0;
  border-radius: 6px;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.context-source-action:hover,
.context-source-action:focus-visible { background: var(--c2l-hover); outline: none; }
.context-source-action:focus-visible { box-shadow: 0 0 0 2px var(--c2l-text); }
.context-source-action:disabled { cursor: default; opacity: 0.25; }
.context-remove { margin-left: 4px; }
.context-sheet footer {
  display: flex;
  flex-direction: column;
  padding: 0;
  border-top: 1px solid var(--c2l-border);
  background: var(--c2l-surface);
}
.context-footer-row {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  min-height: 50px;
  padding: 9px 12px;
}
.context-footer-row + .context-footer-row {
  border-top: 1px solid var(--c2l-border);
}
.context-footer-label {
  color: var(--c2l-text);
  font-size: 10px;
  font-weight: 550;
  line-height: 1.2;
  letter-spacing: 0.065em;
  text-transform: uppercase;
  opacity: 0.5;
}
.context-add,
.context-export,
.context-targets { display: flex; flex-wrap: wrap; gap: 7px; }
.context-add,
.context-export,
.context-targets { align-items: center; }
.context-copy {
  color: var(--c2l-bg);
  background: var(--c2l-text);
  border-color: var(--c2l-text);
}
.context-copy:hover { background: var(--c2l-text); opacity: 0.86; }
.context-target { margin-left: 0; }
.context-sheet .btn:disabled { cursor: default; opacity: 0.38; }
@media (max-width: 560px) {
  .overlay { padding: 10px; }
  .context-sheet { max-height: 92vh; }
  .context-source { align-items: flex-start; gap: 8px; padding: 11px 12px; }
  .context-source-controls { flex: 0 0 auto; }
  .context-remove { margin-left: 0; }
  .context-footer-row {
    grid-template-columns: 1fr;
    gap: 7px;
    padding: 10px 12px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .root.c2l-in,
  .root.c2l-in .btn,
  .root.c2l-in .menuitem { transition: none; }
  .primary.c2l-swap .c2l-ic, .primary.c2l-swap .c2l-label { animation: none; }
}
`;
}
