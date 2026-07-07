---
name: copy2llm
description: Use when asked to add a "Copy to LLM" / "copy page as Markdown" button to a website (plain HTML, React, Next.js, Astro, Framer, any stack), to configure, restyle, update, or remove an existing copy2llm button, to add custom LLM endpoints to it, or when the button extracts wrong content, mismatches the site theme, or doesn't appear.
---

# copy2llm — install and manage the "Copy to LLM" button

## Overview

copy2llm ([copy.computer](https://copy.computer)) adds a button that converts the current page to clean Markdown and copies it or opens it in ChatGPT, Claude, Perplexity, Grok, or a custom endpoint. Fully client-side: no backend, no API key, no account. The UI renders in a Shadow DOM (two-way CSS isolation) and extraction runs on click, so it stays correct in SPAs.

## Pick an install path

| Situation | Use |
|---|---|
| Any site, zero build | `<script>` snippet |
| React / Next.js | `copy2llm-react` |
| Non-React JS, imperative mount/destroy | `copy2llm-widget` |
| Framer site | official plugin |
| Markdown extraction only, no UI | `copy2llm-core` |

### Script tag (any stack)

Place before `</body>` (Next.js: root layout via `<Script strategy="lazyOnload">`; Astro: base layout):

```html
<script src="https://copy.computer/copy2llm.js" defer
        data-position="bottom-right" data-theme="auto"></script>
```

The hosted snippet is unversioned and always latest (cached ≤ 5 min). Add `data-automount="false"` to take control and mount yourself via `window.copy2llm.mount(options, target)`.

### React

```bash
npm i copy2llm-react   # react >= 17 peer dependency
```

```tsx
import { CopyToLLM } from "copy2llm-react";

<CopyToLLM position="bottom-right" theme="auto" />
```

Mounts the widget on mount, tears it down on unmount. `position="inline"` renders an in-flow anchor where placed; any other position mounts onto `document.body`.

### Imperative (non-React)

```ts
import { mount } from "copy2llm-widget"; // npm i copy2llm-widget

const handle = mount({ position: "bottom-right", theme: "auto" });
handle.destroy(); // remove
```

### Framer

Install the official plugin from the Framer marketplace: <https://www.framer.com/community/marketplace/plugins/copy-to-llm/> — configure it from the property panel; same options as below.

## Options

Identical across script `data-*` attributes, React props, and `mount()` options:

| Option | Script attribute | Values | Default |
|---|---|---|---|
| `position` | `data-position` | `bottom-right` `bottom-left` `top-right` `top-left` `inline` | `bottom-right` |
| `theme` | `data-theme` | `auto` `light` `dark` — `auto` matches the host site, falls back to the OS, stays live | `auto` |
| `bg` | `data-bg` | any CSS color | from theme |
| `text` | `data-text` | any CSS color | auto-contrast from `bg` |
| `font` | `data-font` | `sans` `serif` `mono` | `sans` |
| `radius` | `data-radius` | `sharp` `rounded` `pill` or any CSS length | `rounded` |
| `label` | `data-label` | primary button text | `Copy as Markdown` |
| `prompt` | `data-prompt` | lead-in text sent to the LLM before the page's Markdown on the Open in… actions (e.g. "Summarize this API reference"); not available in the Framer plugin | `Here's a web page as Markdown — help me work with it:` |
| `items` | `data-items` | comma-separated from `copy` `view` `chatgpt` `claude` `perplexity` `grok`; first is the primary button | all |
| `header` | `data-header` | `true`/`false` — prepend a title + source header to the Markdown | `true` |
| `content` | `data-content` | CSS selector for the extraction root | auto (Readability) |
| `endpoints` | `data-endpoints` | JSON array of `{ "label", "href" }` custom LLM targets | none |

Custom endpoint `href` is a deep-link template: `{q}` is replaced with the page's Markdown (appended if the template has none; pages too long to inline fall back to a clipboard paste):

```html
data-endpoints='[{"label":"Open in Acme AI","href":"https://acme.ai/?q={q}"}]'
```

## Manage

- **Update**: the script tag auto-updates (hosted, unversioned). npm installs update normally (`npm update copy2llm-react`).
- **Remove**: delete the script tag / component; imperative mounts: `handle.destroy()`.
- **Reconfigure**: change the attributes/props — the widget keeps no other state anywhere.
- Interactive configurator with live preview: <https://copy.computer/#install>

## Verify

Load the page: the button appears at the configured position. Click **Copy as Markdown** — the clipboard should hold clean Markdown of the page (with a title/source header when `header` is on). A click never silently does nothing: every failure degrades to something visible (clipboard fallback, "couldn't extract" toast).

## Common mistakes

- `data-endpoints` must be valid JSON — wrap the attribute value in **single quotes** (JSON needs double quotes inside). Malformed JSON or entries missing string `label`/`href` are silently dropped.
- Invalid `position`/`theme`/`font`/`items` values are silently dropped and defaults apply — check spelling, nothing is logged.
- Button copies nav/sidebar noise → set `content` to the main content selector (e.g. `main`, `article`).
- `data-header` is falsy only for `false`/`0`/`off`/`no`; any other value keeps the header on.
- The widget lives in a Shadow DOM — page CSS cannot restyle it; use `bg`/`text`/`font`/`radius` instead.
