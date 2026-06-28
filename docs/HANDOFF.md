# copy2llm — Session Handoff

**Last updated:** 2026-06-28
**Status:** `@copy2llm/core` complete (built, tested, hardened, linted). Next package: `widget`.

This document is the single entry point for continuing work in a fresh session. Read it top to bottom, then open the two design/plan docs it references.

---

## 1. What this is

A **"Copy to LLM" button any website can embed** — the Mintlify/GitBook "Copy page as Markdown" affordance, generalized so any site can add it. On click it converts the current page to clean Markdown and offers to copy it, view it raw, or open it directly in ChatGPT/Claude.

Shipped through **three install experiences over one shared engine**:
- **JS snippet** — a single `<script>` tag, zero build. The adoption wedge.
- **npm package** — `extract()` + a `<CopyToLLM />` React component for developers.
- **Framer plugin** — the same widget, configured from Framer's property panel.

**Target users:** website creators and developers (docs sites, blogs, marketing/Framer sites).

**Business model:** **free in beta** — optimize for adoption and learning, not revenue. No DB, no backend, no accounts in v1. Monetization (hosted markdown / `llms.txt` / GEO analytics) is explicitly deferred. v1 is **fully client-side**.

Full product reasoning and the validated design: **`docs/plans/2026-06-28-copy2llm-design.md`** (read this second).

---

## 2. Current status at a glance

| Package | State |
|---|---|
| `@copy2llm/core` | ✅ **Done** — extraction engine. 32 tests, hardened, lint-clean, dual ESM/CJS build. |
| `widget` | ⬜ Not started — **next up**. The button UI (Shadow DOM, 4 actions, theming). |
| `snippet` | ⬜ Not started — self-mounting `<script>` bundle for the CDN. |
| `react` | ⬜ Not started — `<CopyToLLM />`. |
| `framer` | ⬜ Not started — Framer plugin. |
| `apps/site` | ⬜ Not started — landing + docs + live demo; dogfoods the button. |

**Immediate next step:** write a `widget` implementation plan (same TDD style as the core plan), then build it.

---

## 3. Repo orientation

```
copy2llm/
├─ package.json            # root, Bun workspaces ("packages/*", "apps/*")
├─ biome.jsonc             # ultracite/biome lint config (see §4)
├─ bun.lock               # committed lockfile
├─ .gitignore             # ignores node_modules, dist, .claude, etc.
├─ docs/
│  ├─ HANDOFF.md           # this file
│  └─ plans/
│     ├─ 2026-06-28-copy2llm-design.md          # the validated product/architecture design
│     └─ 2026-06-28-core-extraction-engine.md   # the core TDD implementation plan (executed)
└─ packages/
   └─ core/                # @copy2llm/core — the extraction engine (DONE)
      ├─ src/              # extract.ts, select-content.ts, to-markdown.ts, absolutize.ts, header.ts, index.ts
      ├─ test/             # *.test.ts (bun:test) + fixtures/
      ├─ package.json, tsconfig.json, tsup.config.ts
```

`dist/` is **gitignored** (build artifacts are produced at publish time, never committed).

---

## 4. Toolchain & how to work (IMPORTANT — read before running anything)

**Use Bun (1.3.x), not pnpm or npm.** pnpm is broken in this environment (corepack fails with a signing-key mismatch under an nvm-managed node, and the pnpm shim points at a missing binary). Don't try to repair pnpm — use Bun. This is also saved in agent memory (`toolchain-bun`).

| Task | Command |
|---|---|
| Install deps | `bun install` (needs network) |
| Run all core tests | `bun test packages/core` |
| Run one test file | `bun test packages/core/test/extract.test.ts` |
| Typecheck | `bun run --filter @copy2llm/core typecheck` |
| Build | `bun run --filter @copy2llm/core build` |
| Lint (check) | `bunx ultracite check .` |
| Lint (autofix) | `bunx ultracite fix <path>` |
| Package types audit | `bunx @arethetypeswrong/cli --pack packages/core` (needs network) |

**Gotchas:**
- **Tests** use Bun's built-in runner — import from `bun:test`, **not** `vitest`. There is no `vitest.config.ts`. DOMs are built in tests with `jsdom`.
- **Linting** is Biome via Ultracite. `biome.jsonc` excludes `**/test/fixtures` (raw sample HTML) and disables `performance/noBarrelFile` (entry points are barrels by design). Keep inline regexes hoisted to module scope (`useTopLevelRegex`).
- **Bare-specifier resolution:** `import "@copy2llm/core"` will NOT resolve until another workspace package depends on it (Bun only symlinks workspace packages that are depended upon). To smoke-test the built package directly: `bun -e "import('./packages/core/dist/index.js').then(m=>console.log(typeof m.extract))"`.
- **Commits:** Conventional Commits, **no AI attribution** in messages.
- **`ultracite init` is interactive** — don't run it from an automated flow; it's already set up.

---

## 5. What's built — `@copy2llm/core`

**Public API** (`packages/core/src/index.ts`):
```ts
extract(document: Document, options?: ExtractOptions): ExtractResult

interface ExtractOptions {
  content?: string;   // CSS selector for the content root; overrides auto-detection
  header?: boolean;   // prepend "# {title}\n\n> Source: {url}"; default true
}
interface ExtractResult { markdown: string; title: string; url: string }
```

**Pipeline** (`extract.ts`), all on a **clone** — never mutates the input document:
1. `selectContent` — author `content` selector → **Readability** auto-detect → fallback `<main>` → `<article>` → `<body>`. Guards against documents with no `<body>` (returns empty root, doesn't throw).
2. `promoteLazyImages` — `data-src`/`data-original`/`data-lazy-src`/`srcset` → `src` (consistent across all paths).
3. `normalizeTables` — pads ragged table rows to the widest row → valid GFM, losslessly.
4. `absolutizeUrls` — relative `href`/`src` → absolute via `document.baseURI`.
5. `toMarkdown` — Turndown + GFM, plus custom rules: removes `script/style/noscript/template`; replaces giant `data:` URIs with a `![alt](data:<mediatype>)` placeholder (token-bomb guard); renders header-less tables as GFM; **fence-aware cleanup** (never touches whitespace inside ``` code blocks ```).
6. `prependHeader` — title + source line; omits the trailing separator when the body is empty.

**Quality:** 32 tests pass · typecheck clean · Biome lint clean · dual ESM (`dist/index.js`) + CJS (`dist/index.cjs`) + types (`.d.ts`/`.d.cts`); `attw` reports all four resolution modes green. Readability/Turndown stay external (not inlined) — `index.js` ≈ 2.6 KB.

---

## 6. Key product decisions (already made — don't relitigate)

From the design doc (`docs/plans/2026-06-28-copy2llm-design.md`). The widget will implement these:

- **Button = split control**: primary action *Copy as Markdown*; caret menu adds *View raw .md* (in-page overlay), *Open in ChatGPT*, *Open in Claude*.
- **"Open in [LLM]"**: default to passing the **page URL** (`chatgpt.com/?q=…`, `claude.ai/new?q=…`); also silently copy the Markdown to the clipboard as a fallback (a full page can't fit in a URL).
- **Rendered in a Shadow DOM** for two-way CSS isolation; lazy extraction on click (SPA-safe).
- **Customization** (identical across snippet `data-*`, npm props, Framer panel):
  `position` · `theme` (auto/light/dark) · `bg` · `text` (auto-contrast) · `font` (sans/serif/mono → system stacks, no web fonts) · `radius` (sharp/rounded/pill/custom) · `content` (selector) · `header` (on/off) · `items`.
- **`theme: auto` = match the *site*, not the OS**: `:root` `color-scheme` → background-luminance sample → `prefers-color-scheme` fallback; stays live via media-query + DOM observer; `theme="light|dark"` pins it.
- **Error handling rule:** a click never does nothing — every failure degrades to something visible (clipboard fallback, "couldn't extract" toast + overlay, non-public-page deep-link handling, CSP escape hatch via the npm package).

---

## 7. How core was built (process notes)

- **TDD**, one concern per commit (see `git log`). The implementation plan is `docs/plans/2026-06-28-core-extraction-engine.md`.
- After the happy-path build, an **adversarial hardening workflow** ran 4 parallel verifier agents (extraction robustness · safety/non-mutation · API/packaging · test-quality) that tried to *break* the engine, then a fix agent reproduced and patched findings with regression tests. It surfaced 17 findings; the **6 high-severity** were fixed (commits `0d75a9a`, `ce50e0d`): data-URI token bomb, header-less table HTML leak, selector-path script/style leak, throw on body-less docs, untested fallback order, code-fence whitespace corruption.
- Then **4 "clear win" medium findings** were fixed (commits `06b7e48`, `49df6bb`, `22a5c65`): exports-map types, lazy images, ragged tables, test-gap coverage.

If you continue, this is a good template: build happy-path with TDD → run an adversarial hardening pass → fix high-severity → cherry-pick clear-win mediums.

---

## 8. Backlog — deferred, need a product decision (not bugs)

These came out of hardening but are judgment calls, best decided in context:
- **Auto-detect keeps `<nav>` on *short* pages** — decide: pre-strip chrome (`nav`/`header`/`footer`) before Readability, or document "auto-detect needs real prose, use a selector otherwise."
- **`<base href>` overrides the Source URL** — currently `document.baseURI` is used for both link resolution *and* the Source line; consider using `document.URL` for Source while keeping `baseURI` for links.
- **Perf:** ~1.2 s for a 5000-node page (Readability clones the whole doc). Inherent; document a node ceiling and/or run extraction off the main thread in the consuming extension.
- **`about:blank`** as a literal Source line (when no real URL); treat as "no URL."
- **Duplicate `<h1>`** when extracted content already opens with the page title (already a known deferred follow-up in the core plan).

Lower-priority hardening findings not yet actioned are listed in the core plan's "Deferred follow-ups" section.

---

## 9. What's next — build sequence

Per the design doc, in order (each is a thin wrapper around `core`):
1. **`widget`** ← next. UI in a Shadow DOM: split button, the 4 actions, theming tokens, the customization table, the `auto`-theme cascade. Build the *eyeball gallery* (page-vs-Markdown side by side) here — extraction quality is subjective and needs visual review.
2. **`snippet`** — bundle `widget` as a self-mounting `<script>`; enforce a hard size budget (<30 KB gzip — it's injected into others' pages).
3. **`apps/site`** — landing + docs + live demo; dogfoods its own button.
4. **`react`** — `<CopyToLLM />`.
5. **`framer`** — the Framer plugin.

**To resume:** write `docs/plans/YYYY-MM-DD-widget.md` (TDD, bite-sized, same shape as the core plan), then execute it. Decide early: does the widget consume `@copy2llm/core` as a workspace dependency (recommended — also fixes the bare-specifier resolution note in §4)?

---

## 10. Conventions

- **Bun** for everything (§4). **TDD** with `bun:test`. **Conventional Commits, no AI attribution.**
- **Ultracite/Biome** must stay green (`bunx ultracite check .`) before considering work done.
- Run linting **and** typecheck **and** tests before claiming completion.
- Minimal code that solves the problem; no speculative features (YAGNI).
- Agent memory lives at `~/.claude/projects/-Users-vladvarbatov-Projects-copy2llm/memory/` (currently: `toolchain-bun`).

## 11. Key files to open first (in order)
1. `docs/HANDOFF.md` ← you are here
2. `docs/plans/2026-06-28-copy2llm-design.md` — product + architecture design
3. `docs/plans/2026-06-28-core-extraction-engine.md` — how core was built (template for next packages)
4. `packages/core/src/extract.ts` — the engine entry point
