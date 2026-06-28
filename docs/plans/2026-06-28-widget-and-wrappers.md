# widget + wrappers — Build Note

**Date:** 2026-06-28
**Scope:** `widget`, `snippet`, `react`, `framer`. **Not** `apps/site` (landing page + eyeball gallery — built later, with the user).
**Process:** TDD (`bun:test` + jsdom), Conventional Commits, Biome green. Same shape as the core plan.

Product decisions are settled in `docs/plans/2026-06-28-copy2llm-design.md` §5–§7 — this note records only the *implementation* shape.

---

## Locked decisions

- **`widget` depends on `@copy2llm/core`** as a workspace dep (`workspace:*`). Fixes the bare-specifier resolution note (HANDOFF §4) and is the recommended path (HANDOFF §9).
- **`framer` = a Framer code component** (`addPropertyControls`), not a full plugin. That *is* "configured from the property panel"; a plugin is YAGNI for v1.
- **No new runtime deps in `widget`** beyond core. System font stacks, no web fonts (design §6).
- **Build with `tsup`** (dual ESM/CJS) for `widget`/`react`; `snippet` builds a single minified IIFE that inlines everything.
- **Tests stay on jsdom** (consistent with core). `matchMedia`/`clipboard`/`window.open` are not in jsdom → injected via a `Window` seam or mocked per test. Shadow DOM (`attachShadow`) is supported by jsdom.

## Widget — public API (`packages/widget/src/index.ts`)

```ts
type Action = 'copy' | 'view' | 'chatgpt' | 'claude';
type Position = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'inline';

interface WidgetOptions {
  content?: string;            // → core ExtractOptions.content
  header?: boolean;            // → core ExtractOptions.header
  position?: Position;         // default 'bottom-right'
  theme?: 'auto' | 'light' | 'dark';  // default 'auto'
  bg?: string;                 // CSS color; default from theme
  text?: string;               // CSS color; default auto-contrast from bg
  font?: 'sans' | 'serif' | 'mono';   // default 'sans' → system stacks
  radius?: 'sharp' | 'rounded' | 'pill' | string;  // default 'rounded'
  items?: Action[];            // default ['copy','view','chatgpt','claude']
  label?: string;              // primary button text; default 'Copy as Markdown'
}

function mount(options?: WidgetOptions, target?: Element): WidgetHandle; // target default document.body
interface WidgetHandle { destroy(): void; }
```

`items` is an ordered filter over `['copy','view','chatgpt','claude']`: **first = primary button**, rest = caret menu. One item → no caret.

## File layout (TDD, one module per concern)

| File | Concern | Test seam |
|---|---|---|
| `options.ts` | defaults + `parseDataset(DOMStringMap)` for the snippet's `data-*` | pure |
| `clipboard.ts` | `copyText()` (clipboard API → `execCommand` fallback), `isPublicUrl()`, `buildLlmUrl()` | mock `navigator`/inject |
| `theme.ts` | `resolveTheme(host, win)` cascade + `watchTheme()` live updates; `contrastText(bg)`, `luminance(rgb)` | inject fake `Window` |
| `styles.ts` | `css(tokens)` → the Shadow-DOM stylesheet string from resolved tokens | pure |
| `widget.ts` | `mount()`: shadow host, split button + menu, overlay, action wiring, idempotency, `destroy()` | jsdom + mocks |
| `index.ts` | barrel | — |

## Non-obvious correctness points (verify in hardening)

- **No self-leak:** the host is a `<div>` whose UI lives in a **shadow root**. `document.cloneNode(true)` (what core/Readability clones) does **not** copy shadow trees, so the host serializes as an empty div → Readability/Turndown emit nothing. No widget text leaks into the extracted Markdown. (Belt: still mark the host with a `data-` attr.)
- **Idempotency** is keyed by `target`: if `target` already holds our host, reuse it (design §7). Default target `document.body` → one button per page; React `inline` can mount into distinct targets.
- **`a click never does nothing`** (design §7): copy failure → open the View overlay; extract empty → toast + overlay with whatever we got; non-public URL (localhost/LAN/`.local`) → skip the deep link, rely on the pre-copied clipboard + a "paste below" toast.
- **`theme:auto` matches the *site*** (design §6): `:root color-scheme` → background-luminance sample → `prefers-color-scheme`. Live via `matchMedia` change + a `MutationObserver` on `<html>`; `light|dark` pins and skips detection. All cleaned up in `destroy()`.

## Wrappers

- **`snippet`**: `src/index.ts` finds its own `<script>` tag (`document.currentScript`), `parseDataset` → `mount`. tsup builds `format:['iife']`, `minify`, **no externals** (inline core + Readability + Turndown). Measure gzip; design budget <30 KB (Readability+Turndown make this tight — **measure and report the real number**, don't assume).
- **`react`**: `src/index.tsx` — `<CopyToLLM {...opts}/>`; `useEffect` calls `mount(opts, ref?)` and returns `destroy`. `inline` → mount into a rendered `<span ref>`; otherwise body. `react` is a peer dep.
- **`framer`**: `src/CopyToLLM.tsx` — same component shape + `addPropertyControls` mapping every knob to a Framer control. `framer`/`react` are peer deps; shim `declare module 'framer'` if the package can't install offline.

## Definition of done

- `bun test` green across all four packages; `tsc --noEmit` clean each; `tsup` builds each.
- `bunx ultracite check .` clean.
- Snippet gzip size measured and reported.
- Adversarial hardening pass run; high-severity findings fixed with regression tests.
- HANDOFF.md updated.
