# copy2llm — Design

**Date:** 2026-06-28
**Status:** Design validated, pre-implementation

---

## 1. Summary

A **"Copy to LLM" button any website can embed** — the Mintlify/GitBook "Copy page as Markdown" affordance, generalized so any site can add it. On click it converts the current page to clean Markdown and offers to copy it, view it raw, or open it directly in ChatGPT/Claude.

Shipped through three install experiences over one shared engine:

- **JS snippet** — a single `<script>` tag, zero build. The wedge.
- **npm package** — `extract()` + a `<CopyToLLM />` React component for developers.
- **Framer plugin** — the same widget, configured from Framer's property panel.

Target users: website creators and developers (docs sites, blogs, marketing/Framer sites).

## 2. Goals & non-goals

**Goals**
- Dead-simple adoption (paste a tag, done).
- Excellent Markdown extraction quality — this is the moat, not the button.
- Look native on the host site (theme, font, color, shape all themeable).

**Non-goals (v1)**
- No monetization. **Free in beta** — optimize for adoption and learning.
- No server-side / build-time extraction yet (better quality, worse first impression — deferred; natural home for a future paid tier).
- No accounts, no network calls from the widget.
- No `llms.txt` generation yet (the frontmatter header is the bridge to it later).

## 3. Architecture — one engine, three wrappers

The extraction engine is the product; the snippet/npm/Framer pieces are just three ways to install it. Build the engine once, wrap it thinly. Small monorepo:

```
copy2llm/
├─ packages/
│  ├─ core      → extract(document, options) → { markdown, title, url }
│  │              Readability (strip nav/footer/ads) + Turndown+GFM
│  │              (HTML→Markdown) + cleanup. Pure, no UI, framework-agnostic.
│  ├─ widget    → split-button + menu UI and click actions, in a Shadow DOM
│  │              so the host site's CSS can't leak in or out. Depends on core.
│  ├─ snippet   → bundles widget as a self-mounting <script> for the CDN.
│  ├─ react     → <CopyToLLM /> for the npm / developer path.
│  └─ framer    → the Framer plugin / code component.
└─ apps/
   └─ site      → landing + live demo + docs; dogfoods its own button.
```

Improve extraction once → every channel benefits. Tooling: pnpm + turbo (or equivalent).

**Tech picks:** Mozilla Readability (main-content isolation, what Firefox Reader Mode uses) + Turndown + turndown-plugin-gfm (HTML→Markdown). Both battle-tested, MIT, small. No hand-rolling.

## 4. Extraction engine

`core.extract(document, options)` runs on a **clone** of the page (live DOM never touched):

1. **Pick the content root.** Author selector (`content: 'main'`) → else Readability auto-detect → fallback `<main>`/`<article>` → `<body>`.
2. **Pre-clean** (body path): strip `script/style/noscript`, `[hidden]`, cookie/consent banners, and our own widget.
3. **Convert** HTML → Markdown via Turndown + GFM (fenced code, tables, task lists, strikethrough).
4. **Post-process:** rewrite relative links/images to absolute via `document.baseURI`; collapse blank-line runs; trim. Prefer real `src`/`data-src` for lazy images; drop giant inline `data:` URIs.
5. **Prepend a 2-line header** (toggleable, default on): page title + source URL. Gives the LLM context; bridges to `llms.txt` later.

Output: `{ markdown, title, url }`. Core stays pure: **DOM in, Markdown out — no UI, no network.**

The single most important option: **`content` (content-root override)**. Auto-detect is great for clean `<article>` pages; messy marketing/Framer DOMs need the one-line escape hatch.

## 5. Widget — button + four actions

Mounts one host node on `document.body`, rendered in a **Shadow DOM** for two-way style isolation. Extraction is **lazy** — `core.extract()` runs on click (reads the live DOM each time → SPA-safe), optionally pre-warmed on menu-open so Copy feels instant.

Split button, Mintlify-style: primary hit is *Copy*; the caret opens the menu.

1. **Copy as Markdown** (primary) → `navigator.clipboard.writeText(markdown)` → "Copied ✓" toast.
2. **View as raw .md** → in-page **overlay** with the raw Markdown in a `<pre>`, its own copy/close buttons. (Client-side has no real `/page.md` URL; an overlay beats a `blob:` tab — works offline, no ugly URL, full control.)
3. **Open in ChatGPT** → silently copies Markdown to clipboard as a fallback, then opens `chatgpt.com/?q=<short prompt + page URL>`. URL is the primary path; clipboard is the safety net if the fetch doesn't land.
4. **Open in Claude** → same, via `claude.ai/new?q=…`.

## 6. Customization

Theming layer = **CSS custom properties** inside the Shadow DOM. `theme` sets token defaults; explicit props override individual tokens. Identical knobs across all three channels (snippet `data-*`, npm props, Framer property-panel controls).

| Prop | Values | Default |
|---|---|---|
| `position` | bottom-right · bottom-left · top-right · top-left · inline | bottom-right |
| `theme` | auto · light · dark | auto |
| `bg` | any CSS color | (from theme) |
| `text` | any CSS color | (auto-contrast from `bg`) |
| `font` | sans · serif · mono | sans |
| `radius` | sharp · rounded · pill · (custom length) | rounded |
| `content` | CSS selector (extraction root) | (auto-detect) |
| `header` | frontmatter on/off | on |
| `items` | which of the 4 actions to show | all |

Deliberate choices:

- **`font` → system stacks, not web fonts.** `sans` → `system-ui…`, `serif` → `Georgia…`, `mono` → `ui-monospace, SFMono…`. No font files, no network request — keeps the snippet in budget, zero added latency.
- **`text` auto-derives from `bg` when unset**, with a contrast check so bad combos degrade gracefully. Border + hover shades derive from `bg` too — one color input themes the whole button.

**`theme: auto` resolution — match the *site*, fall back to the OS** (the button is embedded; it should look native):

1. `color-scheme` declared on `:root` → trust it.
2. Else **background-luminance sample** behind the button → dark/light.
3. Else `prefers-color-scheme` (end-user OS), only when the site gives no signal.

Stays live: media-query listener (OS flips) + light observer on `<html>` class/`data-theme`/style (site toggle). `theme="light"|"dark"` pins it and skips detection (escape hatch for the luminance sniff's one failure mode — gradient/image backgrounds).

## 7. Error handling & edge cases

Rule: **a click never does nothing** — every failure degrades to something visible.

- **Clipboard blocked** (insecure context/old browser): fall back to hidden-textarea `execCommand('copy')`; if that fails, auto-open the View overlay for manual copy.
- **Empty/garbage extraction:** core's fallback chain (Readability → main/article → body); if still empty, toast "Couldn't extract this page" + open overlay with whatever we got.
- **Relative links/images:** resolved to absolute via `document.baseURI`.
- **Deep-link to a non-public page** (localhost/staging/authed): detect non-fetchable hosts, skip the URL path, rely on pre-copied clipboard + "paste below" prompt.
- **Strict CSP:** CDN `<script>` can trip `script-src`, inline styles `style-src`. **npm package is the escape hatch** (bundled); document nonce/hash guidance for the snippet.
- **Double-mount:** idempotent — if our host node exists, don't add a second.
- **Accessibility:** real `<button>`, keyboard-navigable menu (`aria-haspopup`/`expanded`), focus-trapped overlay, respects `prefers-color-scheme` + `prefers-reduced-motion`.

## 8. Testing

- **Core — fixture snapshots.** Real-world HTML snapshots (clean docs `<article>`, messy Framer page, blog, table/code-heavy page, nav+banner+footer page) → `extract()` → assert against known-good Markdown. Run in a **real headless browser** (Playwright / Vitest browser mode), not jsdom (Readability diverges). Plus targeted units: relative→absolute URLs, GFM tables, fenced code, content-root override, fallback chain.
- **Widget — mocked actions.** Menu open + keyboard nav; mock `clipboard.writeText` (asserts Markdown); mock `window.open` (asserts deep-link URL + encoding); insecure-context fallback; idempotent mount.
- **E2E — Playwright** against locally-served fixtures: click Copy → read actual clipboard → assert; Open in ChatGPT → assert popup URL.
- **Eyeball harness.** A fixtures *gallery* in `apps/site`: each page shown **page-vs-Markdown side by side** — the only honest judge of extraction quality. Docs site dogfoods its own button.
- **CI gates:** lint + typecheck + unit + e2e per PR, plus a hard **bundle-size budget** on the snippet (~<30kb gzip — it's injected into others' pages).

## 9. Open questions / deferred

- **Monetization** — decide after beta signal. Candidate paid layer: hosted Markdown endpoints, `llms.txt` generation + hosting, "who's pulling your content into LLMs" / GEO analytics.
- **Server-side / build-time extraction** — higher quality, needs setup; future, likely paired with the paid tier.
- **More framework wrappers** (Vue/Svelte) — only on demand. YAGNI for v1.
- **Strategic watch:** "copy Markdown" may be a bridge behavior as LLMs fetch URLs directly. The durable value may shift toward the content layer (clean `.md`/`llms.txt`). Button = viral wedge; content layer = possible substance.

## 10. Suggested build sequence

1. `core` extraction engine + fixture snapshot tests (the hard, valuable part — nail it first).
2. `widget` (Shadow DOM, split button, 4 actions, theming tokens) + the eyeball gallery.
3. `snippet` bundle + CDN + size budget.
4. `apps/site` landing + live demo + docs (dogfoods the button).
5. `react` wrapper.
6. `framer` plugin.
