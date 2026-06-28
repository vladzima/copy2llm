import type { Theme } from "./options";

export type ResolvedTheme = "light" | "dark";

type Rgba = [number, number, number, number];

const HEX = /^#([0-9a-f]{3,8})$/i;
const RGB = /^rgba?\(([^)]+)\)$/i;
const SPLIT = /[\s,/]+/;
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Parse `#rgb`/`#rrggbb(aa)` and `rgb()/rgba()` to `[r,g,b,a]`. Returns null otherwise. */
export function parseColor(value: string): Rgba | null {
  const v = value.trim();

  const hex = HEX.exec(v);
  if (hex) {
    return parseHex(hex[1]);
  }

  const rgb = RGB.exec(v);
  if (rgb) {
    const parts = rgb[1]
      .split(SPLIT)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length < 3) {
      return null;
    }
    const [r, g, b] = parts.map(Number);
    // ponytail: no `%` channel support — getComputedStyle never emits it; add if an author needs it.
    if ([r, g, b].some((n) => Number.isNaN(n))) {
      return null;
    }
    const a = parts[3] === undefined ? 1 : Number(parts[3]);
    return [r, g, b, Number.isNaN(a) ? 1 : a];
  }

  return null;
}

function parseHex(hex: string): Rgba | null {
  let h = hex;
  if (h.length === 3 || h.length === 4) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length !== 6 && h.length !== 8) {
    return null;
  }
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  const a = h.length === 8 ? Number.parseInt(h.slice(6, 8), 16) / 255 : 1;
  return [r, g, b, a];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.039_28 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance (0 = black, 1 = white). */
function relativeLuminance([r, g, b]: Rgba): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Readable foreground (#111/#fff) for a parseable background color; #111 if unparseable. */
export function contrastText(bg: string): string {
  const rgba = parseColor(bg);
  if (!rgba) {
    return "#111111";
  }
  return relativeLuminance(rgba) > 0.5 ? "#111111" : "#ffffff";
}

function readColorScheme(win: Window): string {
  const root = win.document.documentElement;
  let computed = "";
  try {
    computed = win.getComputedStyle(root).colorScheme ?? "";
  } catch {
    computed = "";
  }
  return (computed || root.style.colorScheme || "").toLowerCase();
}

/** Walk up from `host` and return the luminance of the first opaque background, else null. */
function sampleBackgroundLuminance(host: Element, win: Window): number | null {
  let el: Element | null = host;
  while (el) {
    let bg = "";
    try {
      bg = win.getComputedStyle(el).backgroundColor;
    } catch {
      bg = "";
    }
    const rgba = bg ? parseColor(bg) : null;
    if (rgba && rgba[3] > 0) {
      return relativeLuminance(rgba);
    }
    el = el.parentElement;
  }
  return null;
}

function prefersDark(win: Window): boolean | null {
  if (typeof win.matchMedia !== "function") {
    return null;
  }
  try {
    return win.matchMedia(DARK_QUERY).matches;
  } catch {
    return null;
  }
}

/**
 * Resolve `auto` to a concrete theme by matching the *site*, then the OS:
 * 1. `:root` `color-scheme` (if unambiguous) → 2. background-luminance behind the
 * button → 3. `prefers-color-scheme`. `light`/`dark` pin the value and skip all of it.
 */
export function resolveTheme(
  theme: Theme,
  host: Element,
  win: Window
): ResolvedTheme {
  if (theme === "light" || theme === "dark") {
    return theme;
  }

  const scheme = readColorScheme(win);
  const hasDark = scheme.includes("dark");
  const hasLight = scheme.includes("light");
  if (hasDark !== hasLight) {
    return hasDark ? "dark" : "light";
  }

  const lum = sampleBackgroundLuminance(host, win);
  if (lum !== null) {
    return lum < 0.5 ? "dark" : "light";
  }

  return prefersDark(win) ? "dark" : "light";
}

/**
 * Keep `auto` live: re-resolve on OS theme flips (`matchMedia`) and on site theme
 * toggles (class/`data-theme`/style changes on `<html>`). No-op when pinned.
 * Returns a cleanup that detaches every listener.
 */
export function watchTheme(
  theme: Theme,
  host: Element,
  win: Window,
  onChange: (resolved: ResolvedTheme) => void
): () => void {
  if (theme !== "auto") {
    return () => {
      // pinned: nothing to watch
    };
  }

  const recompute = () => onChange(resolveTheme("auto", host, win));

  const cleanups: Array<() => void> = [];

  if (typeof win.matchMedia === "function") {
    try {
      const mql = win.matchMedia(DARK_QUERY);
      mql.addEventListener("change", recompute);
      cleanups.push(() => mql.removeEventListener("change", recompute));
    } catch {
      // matchMedia unsupported — site-toggle observer still applies.
    }
  }

  const observer = new win.MutationObserver(recompute);
  observer.observe(win.document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme", "style"],
  });
  cleanups.push(() => observer.disconnect());

  return () => {
    for (const c of cleanups) {
      c();
    }
  };
}
