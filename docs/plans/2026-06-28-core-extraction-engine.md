# core Extraction Engine — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Each task follows @superpowers:test-driven-development (red → green → commit).

**Goal:** Build `@copy2llm/core` — a pure, framework-agnostic function `extract(document, options) → { markdown, title, url }` that turns a live DOM into clean Markdown.

**Architecture:** A small composable pipeline. `selectContent` picks the content root (author selector → Readability → `<main>`/`<article>`/`<body>` fallback). `absolutizeUrls` rewrites relative links/images. `toMarkdown` runs Turndown + GFM and cleans whitespace. `header` prepends a title + source line. `extract` wires them together. No UI, no network — DOM in, Markdown out.

**Tech Stack:** TypeScript, `@mozilla/readability`, `turndown` + `turndown-plugin-gfm`, **Bun** (`bun install` + the built-in `bun test` runner) with `jsdom` to build test DOMs, and `tsup` for the dual ESM/CJS build. (pnpm is broken in this environment — see Assumptions.)

---

## Assumptions & deviations (read first)

- **Monorepo, first package.** This plan also scaffolds the Bun workspace root, since `core` is the first package to land. Other packages (`widget`, `snippet`, `react`, `framer`, `apps/site`) come in later plans.
- **Toolchain override (pnpm → Bun).** The design assumed pnpm, but pnpm is broken in this environment (corepack signing-key mismatch under nvm). Use **Bun 1.3.x** — workspaces, install, and the built-in test runner. Conventions used throughout:
  - run one test file → `bun test packages/core/test/<name>.test.ts`
  - run all core tests → `bun test packages/core`
  - typecheck → `bun run --filter @copy2llm/core typecheck`
  - build → `bun run --filter @copy2llm/core build`
  - dependencies are declared in `packages/core/package.json`, then installed with `bun install` at the repo root
  - test files import from `bun:test` (not `vitest`); there is no `vitest.config.ts`
  - Bun reads the `workspaces` field in the root `package.json`; there is no `pnpm-workspace.yaml`
- **Deviation from design doc §8 (tests in a real browser).** This plan runs tests with **Bun's test runner, building DOMs via `jsdom`**, not a headless browser. Rationale: `@mozilla/readability` + `jsdom` is the standard pairing and reliable for *structural* extraction, and it keeps the TDD loop fast and deterministic. True in-browser fidelity is validated later by Playwright E2E tests at the widget/app layer (design §8). A dedicated browser-fidelity pass for `core` is a **deferred follow-up** (see end).
- **Linter.** Task 1 wires up Ultracite (Biome) per project convention so all subsequent code is clean from the first commit.
- **No worktree** — implement directly in the main workspace, per request.
- **Commit style:** Conventional Commits, no AI attribution.

---

## Task 1: Scaffold the workspace and the `core` package

**Files:**
- Create: `package.json` (repo root, includes the `workspaces` field)
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/tsup.config.ts`
- Create: `packages/core/src/types/turndown-plugin-gfm.d.ts`
- Create: `packages/core/test/smoke.test.ts`

**Step 1: Create the workspace root file.**

`package.json` (root):
```json
{
  "name": "copy2llm",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "apps/*"],
  "scripts": {
    "test": "bun test",
    "build": "bun run --filter '*' build",
    "typecheck": "bun run --filter '*' typecheck",
    "lint": "biome check ."
  }
}
```

**Step 2: Create the `core` package files.**

`packages/core/package.json` (dependencies declared here; installed in Step 3):
```json
{
  "name": "@copy2llm/core",
  "version": "0.0.0",
  "type": "module",
  "description": "Turn a live DOM into clean Markdown.",
  "license": "MIT",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  },
  "files": ["dist"],
  "scripts": {
    "test": "bun test",
    "build": "tsup",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@mozilla/readability": "^0.5.0",
    "turndown": "^7.2.0",
    "turndown-plugin-gfm": "^1.0.2"
  },
  "devDependencies": {
    "@types/jsdom": "^21.1.0",
    "@types/turndown": "^5.0.0",
    "bun-types": "^1.3.0",
    "jsdom": "^25.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.0.0"
  }
}
```

`packages/core/tsconfig.json` (no `types` restriction, so `@types/turndown` auto-loads for the `src` typecheck):
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "declaration": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

`packages/core/tsup.config.ts`:
```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
});
```

`packages/core/src/types/turndown-plugin-gfm.d.ts` (the package ships no types):
```ts
declare module 'turndown-plugin-gfm' {
  import type TurndownService from 'turndown';
  export const gfm: TurndownService.Plugin;
  export const tables: TurndownService.Plugin;
  export const strikethrough: TurndownService.Plugin;
  export const taskListItems: TurndownService.Plugin;
}
```

**Step 3: Install dependencies** from the repo root:

```bash
bun install
```
Expected: Bun resolves the declared deps, writes `bun.lock`, and links `@copy2llm/core` into the workspace.

**Step 4: Wire up the linter** (project convention):

```bash
bunx ultracite init
```
Accept defaults; this creates `biome.jsonc` at the root. If it prompts for a package manager, choose bun.

**Step 5: Add a smoke test to prove the toolchain runs.**

`packages/core/test/smoke.test.ts`:
```ts
import { test, expect } from 'bun:test';
import { JSDOM } from 'jsdom';

test('jsdom builds a document', () => {
  const dom = new JSDOM('<!DOCTYPE html><title>Hi</title><body><p>ok</p>');
  expect(dom.window.document.querySelector('p')?.textContent).toBe('ok');
});
```

**Step 6: Run the smoke test.**

Run: `bun test packages/core/test/smoke.test.ts`
Expected: PASS — 1 pass, 0 fail.

**Step 7: Commit.**

```bash
git add -A
git commit -m "chore: scaffold bun workspace and @copy2llm/core package"
```

---

## Task 2: `absolutizeUrls` — resolve relative links and images

**Files:**
- Create: `packages/core/test/absolutize.test.ts`
- Create: `packages/core/src/absolutize.ts`

**Step 1: Write the failing test.**

`packages/core/test/absolutize.test.ts`:
```ts
import { test, expect } from 'bun:test';
import { JSDOM } from 'jsdom';
import { absolutizeUrls } from '../src/absolutize';

function body(html: string, url = 'https://example.com/docs/page') {
  return new JSDOM(`<!DOCTYPE html><body>${html}</body>`, { url }).window.document.body;
}

test('resolves a root-relative anchor href', () => {
  const root = body('<a href="/about">About</a>');
  absolutizeUrls(root, 'https://example.com/docs/page');
  expect(root.querySelector('a')?.getAttribute('href')).toBe('https://example.com/about');
});

test('resolves a relative img src against the page directory', () => {
  const root = body('<img src="../img/logo.png">');
  absolutizeUrls(root, 'https://example.com/docs/page');
  expect(root.querySelector('img')?.getAttribute('src')).toBe('https://example.com/img/logo.png');
});

test('leaves already-absolute urls untouched', () => {
  const root = body('<a href="https://other.com/x">x</a>');
  absolutizeUrls(root, 'https://example.com/');
  expect(root.querySelector('a')?.getAttribute('href')).toBe('https://other.com/x');
});

test('no-ops when baseUrl is empty', () => {
  const root = body('<a href="/about">About</a>');
  absolutizeUrls(root, '');
  expect(root.querySelector('a')?.getAttribute('href')).toBe('/about');
});
```

**Step 2: Run it to verify it fails.**

Run: `bun test packages/core/test/absolutize.test.ts`
Expected: FAIL — `Cannot find module '../src/absolutize'`.

**Step 3: Write the minimal implementation.**

`packages/core/src/absolutize.ts`:
```ts
/** Rewrite relative <a href> and <img src> under `root` to absolute URLs. Mutates in place. */
export function absolutizeUrls(root: Element, baseUrl: string): void {
  if (!baseUrl) return;

  const resolve = (value: string): string | null => {
    try {
      return new URL(value, baseUrl).href;
    } catch {
      return null;
    }
  };

  const rewrite = (selector: string, attr: 'href' | 'src') => {
    for (const el of Array.from(root.querySelectorAll(selector))) {
      const value = el.getAttribute(attr);
      if (!value) continue;
      const abs = resolve(value);
      if (abs) el.setAttribute(attr, abs);
    }
  };

  rewrite('a[href]', 'href');
  rewrite('img[src]', 'src');
}
```

**Step 4: Run it to verify it passes.**

Run: `bun test packages/core/test/absolutize.test.ts`
Expected: PASS — 4 pass.

**Step 5: Commit.**

```bash
git add packages/core/src/absolutize.ts packages/core/test/absolutize.test.ts
git commit -m "feat(core): absolutize relative links and images"
```

---

## Task 3: `toMarkdown` — Turndown + GFM + whitespace cleanup

**Files:**
- Create: `packages/core/test/to-markdown.test.ts`
- Create: `packages/core/src/to-markdown.ts`

**Step 1: Write the failing test.**

`packages/core/test/to-markdown.test.ts`:
```ts
import { test, expect } from 'bun:test';
import { JSDOM } from 'jsdom';
import { toMarkdown } from '../src/to-markdown';

function node(html: string) {
  return new JSDOM(`<!DOCTYPE html><body>${html}</body>`).window.document.body;
}

test('converts heading + paragraph with collapsed blank lines', () => {
  expect(toMarkdown(node('<h1>Title</h1><p>Hello</p>'))).toBe('# Title\n\nHello');
});

test('converts a GFM table', () => {
  const md = toMarkdown(
    node('<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>'),
  );
  expect(md).toContain('| A | B |');
  expect(md).toContain('| 1 | 2 |');
});

test('converts a fenced code block', () => {
  const md = toMarkdown(node('<pre><code class="language-js">const x = 1;</code></pre>'));
  expect(md).toContain('```');
  expect(md).toContain('const x = 1;');
});
```

**Step 2: Run it to verify it fails.**

Run: `bun test packages/core/test/to-markdown.test.ts`
Expected: FAIL — `Cannot find module '../src/to-markdown'`.

**Step 3: Write the minimal implementation.**

`packages/core/src/to-markdown.ts`:
```ts
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

/** Collapse 3+ newlines, strip trailing spaces, trim. */
export function cleanup(md: string): string {
  return md
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Convert a DOM node's contents to clean Markdown. */
export function toMarkdown(root: Node): string {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    hr: '---',
  });
  td.use(gfm);
  // @types/turndown types the arg as string | TurndownService.Node; a DOM node is valid at runtime.
  const md = td.turndown(root as unknown as TurndownService.Node);
  return cleanup(md);
}
```

**Step 4: Run it to verify it passes.**

Run: `bun test packages/core/test/to-markdown.test.ts`
Expected: PASS — 3 pass.

**Step 5: Commit.**

```bash
git add packages/core/src/to-markdown.ts packages/core/test/to-markdown.test.ts
git commit -m "feat(core): html-to-markdown via turndown + gfm"
```

---

## Task 4: `prependHeader` — title + source frontmatter

**Files:**
- Create: `packages/core/test/header.test.ts`
- Create: `packages/core/src/header.ts`

**Step 1: Write the failing test.**

`packages/core/test/header.test.ts`:
```ts
import { test, expect } from 'bun:test';
import { prependHeader } from '../src/header';

test('prepends title and source', () => {
  expect(prependHeader('Body.', 'My Page', 'https://x.com/p')).toBe(
    '# My Page\n\n> Source: https://x.com/p\n\nBody.',
  );
});

test('omits the title line when title is empty', () => {
  expect(prependHeader('Body.', '', 'https://x.com/p')).toBe('> Source: https://x.com/p\n\nBody.');
});

test('returns the body unchanged when nothing to prepend', () => {
  expect(prependHeader('Body.', '', '')).toBe('Body.');
});
```

**Step 2: Run it to verify it fails.**

Run: `bun test packages/core/test/header.test.ts`
Expected: FAIL — `Cannot find module '../src/header'`.

**Step 3: Write the minimal implementation.**

`packages/core/src/header.ts`:
```ts
/** Prepend a 2-line header (title + source URL). Either line is omitted if empty. */
export function prependHeader(markdown: string, title: string, url: string): string {
  const parts: string[] = [];
  if (title) parts.push(`# ${title}`);
  if (url) parts.push(`> Source: ${url}`);
  if (parts.length === 0) return markdown;
  return `${parts.join('\n\n')}\n\n${markdown}`;
}
```

**Step 4: Run it to verify it passes.**

Run: `bun test packages/core/test/header.test.ts`
Expected: PASS — 3 pass.

**Step 5: Commit.**

```bash
git add packages/core/src/header.ts packages/core/test/header.test.ts
git commit -m "feat(core): prepend title + source header"
```

---

## Task 5: `selectContent` — selector override → Readability → fallback

**Files:**
- Create: `packages/core/test/select-content.test.ts`
- Create: `packages/core/src/select-content.ts`

> Note: if `tsc --noEmit` later complains that `@mozilla/readability` has no types, add a one-line `declare module '@mozilla/readability'` shim next to the gfm shim, or install its types. Recent versions ship their own declarations.

**Step 1: Write the failing test.**

`packages/core/test/select-content.test.ts`:
```ts
import { test, expect } from 'bun:test';
import { JSDOM } from 'jsdom';
import { selectContent } from '../src/select-content';

function doc(html: string, url = 'https://example.com/') {
  return new JSDOM(html, { url }).window.document;
}

test('an explicit selector wins over everything else', () => {
  const d = doc(
    '<html><head><title>T</title></head><body><nav>NAVTEXT</nav><section id="main"><p>PICKED</p></section></body></html>',
  );
  const { root, title } = selectContent(d, '#main');
  expect(root.textContent).toContain('PICKED');
  expect(root.textContent).not.toContain('NAVTEXT');
  expect(title).toBe('T');
});

test('extracts the main content when no selector is given', () => {
  // Behaviour assertion: content survives whether Readability or the <main> fallback produced it.
  const d = doc('<html><head><title>T</title></head><body><main><p>MAIN CONTENT</p></main></body></html>');
  const { root } = selectContent(d);
  expect(root.textContent).toContain('MAIN CONTENT');
});

test('falls back to <body> when there is no main/article and readability finds nothing', () => {
  const d = doc('<html><head><title>T</title></head><body><div><p>LOOSE</p></div></body></html>');
  const { root } = selectContent(d);
  expect(root.textContent).toContain('LOOSE');
});
```

**Step 2: Run it to verify it fails.**

Run: `bun test packages/core/test/select-content.test.ts`
Expected: FAIL — `Cannot find module '../src/select-content'`.

**Step 3: Write the minimal implementation.**

`packages/core/src/select-content.ts`:
```ts
import { Readability } from '@mozilla/readability';

export interface SelectedContent {
  root: HTMLElement;
  title: string;
}

/** Pick the content root: author selector → Readability → <main>/<article>/<body>. */
export function selectContent(document: Document, selector?: string): SelectedContent {
  const docTitle = document.title ?? '';

  if (selector) {
    const el = document.querySelector(selector);
    if (el) return { root: el.cloneNode(true) as HTMLElement, title: docTitle };
  }

  const article = tryReadability(document);
  if (article) {
    const container = document.createElement('div');
    container.innerHTML = article.content;
    return { root: container, title: article.title || docTitle };
  }

  const fallback =
    document.querySelector('main') ?? document.querySelector('article') ?? document.body;
  return { root: fallback.cloneNode(true) as HTMLElement, title: docTitle };
}

/** Readability mutates the document it parses, so run it on a clone. */
function tryReadability(document: Document): { title: string; content: string } | null {
  try {
    const clone = document.cloneNode(true) as Document;
    const article = new Readability(clone).parse();
    if (!article?.content) return null;
    return { title: article.title ?? '', content: article.content };
  } catch {
    return null;
  }
}
```

**Step 4: Run it to verify it passes.**

Run: `bun test packages/core/test/select-content.test.ts`
Expected: PASS — 3 pass.

**Step 5: Commit.**

```bash
git add packages/core/src/select-content.ts packages/core/test/select-content.test.ts
git commit -m "feat(core): select content root with readability + fallback"
```

---

## Task 6: `extract` — wire the pipeline + public API

**Files:**
- Create: `packages/core/test/extract.test.ts`
- Create: `packages/core/src/extract.ts`
- Create: `packages/core/src/index.ts`

**Step 1: Write the failing test.**

`packages/core/test/extract.test.ts`:
```ts
import { test, expect } from 'bun:test';
import { JSDOM } from 'jsdom';
import { extract } from '../src/index';

function doc(html: string, url = 'https://example.com/docs/page') {
  return new JSDOM(html, { url }).window.document;
}

const PAGE =
  '<html><head><title>Doc Title</title></head><body>' +
  '<nav>NAVTEXT</nav>' +
  '<article id="c"><h2>Hello</h2><p>World <a href="/x">link</a></p></article>' +
  '</body></html>';

test('extracts selector content to markdown with header and absolute links', () => {
  const { markdown, title, url } = extract(doc(PAGE), { content: '#c' });
  expect(title).toBe('Doc Title');
  expect(url).toBe('https://example.com/docs/page');
  expect(markdown).toContain('# Doc Title');
  expect(markdown).toContain('> Source: https://example.com/docs/page');
  expect(markdown).toContain('## Hello');
  expect(markdown).toContain('World [link](https://example.com/x)');
  expect(markdown).not.toContain('NAVTEXT');
});

test('header:false omits the frontmatter', () => {
  const d = doc('<html><head><title>T</title></head><body><article id="c"><p>Body</p></article></body></html>');
  expect(extract(d, { content: '#c', header: false }).markdown).toBe('Body');
});
```

**Step 2: Run it to verify it fails.**

Run: `bun test packages/core/test/extract.test.ts`
Expected: FAIL — `Cannot find module '../src/index'`.

**Step 3: Write the minimal implementation.**

`packages/core/src/extract.ts`:
```ts
import { absolutizeUrls } from './absolutize';
import { prependHeader } from './header';
import { selectContent } from './select-content';
import { toMarkdown } from './to-markdown';

export interface ExtractOptions {
  /** CSS selector for the content root. Overrides auto-detection. */
  content?: string;
  /** Prepend a title + source header. Default: true. */
  header?: boolean;
}

export interface ExtractResult {
  markdown: string;
  title: string;
  url: string;
}

/** Convert a DOM into clean Markdown. Does not mutate the passed document. */
export function extract(document: Document, options: ExtractOptions = {}): ExtractResult {
  const { content, header = true } = options;
  const url = document.baseURI || document.URL || '';

  const { root, title } = selectContent(document, content);
  absolutizeUrls(root, url);
  let markdown = toMarkdown(root);
  if (header) markdown = prependHeader(markdown, title, url);

  return { markdown, title, url };
}
```

`packages/core/src/index.ts`:
```ts
export { extract } from './extract';
export type { ExtractOptions, ExtractResult } from './extract';
```

**Step 4: Run it to verify it passes.**

Run: `bun test packages/core/test/extract.test.ts`
Expected: PASS — 2 pass.

**Step 5: Run the whole suite + typecheck.**

Run: `bun test packages/core && bun run --filter @copy2llm/core typecheck`
Expected: all tests PASS; `tsc --noEmit` prints nothing (exit 0).

**Step 6: Commit.**

```bash
git add packages/core/src/extract.ts packages/core/src/index.ts packages/core/test/extract.test.ts
git commit -m "feat(core): extract() pipeline and public api"
```

---

## Task 7: Real-world fixture tests (Readability quality)

**Files:**
- Create: `packages/core/test/fixtures/docs-article.html`
- Create: `packages/core/test/fixtures/marketing-messy.html`
- Create: `packages/core/test/fixtures.test.ts`

**Step 1: Add fixtures.**

`packages/core/test/fixtures/docs-article.html` — a realistic doc page with chrome Readability should strip:
```html
<!DOCTYPE html>
<html>
  <head><title>Installing the Widget</title></head>
  <body>
    <header><nav>Home · Docs · Pricing · CHROME_NAV</nav></header>
    <article>
      <h1>Installing the Widget</h1>
      <p>The widget is a single script tag. Drop it into your page and a button appears. This paragraph exists to give Readability enough signal to treat this article as the main content rather than the surrounding navigation chrome.</p>
      <h2>Configuration</h2>
      <p>You can set the position, theme, and font. See the table below for the full set of options that the widget understands at mount time.</p>
      <pre><code class="language-html">&lt;script src="cdn"&gt;&lt;/script&gt;</code></pre>
      <p>Read more in the <a href="/docs/options">options reference</a>.</p>
    </article>
    <footer>FOOTER_LEGAL · © 2026</footer>
  </body>
</html>
```

`packages/core/test/fixtures/marketing-messy.html` — a landing page where the author would pass a selector:
```html
<!DOCTYPE html>
<html>
  <head><title>Acme — Ship Faster</title></head>
  <body>
    <div class="hero"><div class="nav">NAV_JUNK</div><h1>Ship Faster</h1></div>
    <main id="content">
      <h2>Why Acme</h2>
      <p>Acme helps teams ship. This is the real content an author would target with a selector.</p>
    </main>
    <div class="cookie-banner">We use cookies — COOKIE_JUNK</div>
  </body>
</html>
```

**Step 2: Write the failing test.**

`packages/core/test/fixtures.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test, expect } from 'bun:test';
import { JSDOM } from 'jsdom';
import { extract } from '../src/index';

const here = dirname(fileURLToPath(import.meta.url));
const load = (name: string, url: string) =>
  new JSDOM(readFileSync(join(here, 'fixtures', name), 'utf8'), { url }).window.document;

test('docs page: keeps the article, drops nav and footer', () => {
  const { markdown } = extract(load('docs-article.html', 'https://acme.com/docs/install'));
  expect(markdown).toContain('## Configuration');
  expect(markdown).toContain('[options reference](https://acme.com/docs/options)');
  expect(markdown).not.toContain('CHROME_NAV');
  expect(markdown).not.toContain('FOOTER_LEGAL');
});

test('messy marketing page: selector targets the real content, drops junk', () => {
  const { markdown } = extract(load('marketing-messy.html', 'https://acme.com/'), { content: '#content' });
  expect(markdown).toContain('## Why Acme');
  expect(markdown).not.toContain('NAV_JUNK');
  expect(markdown).not.toContain('COOKIE_JUNK');
});
```

**Step 3: Run it.**

Run: `bun test packages/core/test/fixtures.test.ts`
Expected: PASS — 2 pass.
If the docs test fails because Readability did not strip the nav/footer, enlarge the article prose (more paragraphs) until Readability confidently selects it — this fixture is also the realistic signal that extraction quality is good.

**Step 4: Commit.**

```bash
git add packages/core/test/fixtures.test.ts packages/core/test/fixtures/
git commit -m "test(core): real-world fixture extraction"
```

---

## Task 8: Build, package exports, and a size sanity check

**Step 1: Build.**

Run: `bun run --filter @copy2llm/core build`
Expected: `tsup` writes `dist/index.js` (ESM), `dist/index.cjs` (CJS), `dist/index.d.ts`, and source maps; exits 0.

**Step 2: Verify the published shape resolves.**

Run: `bun -e "import('@copy2llm/core').then(m => console.log(typeof m.extract))"`
Expected: prints `function`.

**Step 3: Eyeball the bundle size.**

Run: `ls -lh packages/core/dist`
Expected: `index.js` is small (single-digit KB — Readability/Turndown are runtime deps, not inlined). Note the number in the commit body for later reference.

**Step 4: Full green gate.**

Run: `bun test packages/core && bun run --filter @copy2llm/core typecheck && bun run --filter @copy2llm/core build`
Expected: tests PASS, typecheck clean, build succeeds.

**Step 5: Commit.**

```bash
git add packages/core/package.json
git commit -m "build(core): tsup dual esm/cjs output with types"
```

---

## Definition of done

- `extract(document, options)` returns `{ markdown, title, url }`.
- Selector override, Readability auto-detect, and `<main>`/`<article>`/`<body>` fallback all covered by passing tests.
- Relative links/images absolutized; GFM tables/code/lists convert; header toggles.
- `bun test packages/core` green, typecheck clean, `build` produces ESM + CJS + types.
- All work committed in small, conventional commits.

## Deferred follow-ups (out of scope here)

- **Browser-fidelity pass** for `core` (Playwright) to confirm in-browser extraction matches the jsdom-based tests (design §8).
- **Cookie/consent-banner blocklist** on the `<body>` fallback path (design §4 pre-clean) — add when a fixture demonstrates the need.
- **Lazy-image handling** (`data-src`, dropping giant inline `data:` URIs) — add with a fixture that exercises it.
- **`header` duplicate-h1 guard**: if extracted content already opens with the page title as an `<h1>`, the prepended `# {title}` may duplicate it. Refine when a fixture shows it.
