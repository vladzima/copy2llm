# copy2llm

The **portable context layer between websites and AI**. Any site can add one button that lets readers capture a page, selection, or section; review multiple sources in a local Context Cart; then copy, download, or send the bundle to ChatGPT, Claude, Perplexity, Grok, or a custom endpoint.

**Capture → Review → Send:** an active text selection becomes the context automatically. "Copy a section" or "Add a section" lets the reader pick a block. Context sources stay in `sessionStorage` for the current tab, where they can be reordered, removed, copied, downloaded, or sent together.

Free in beta · fully client-side · no accounts, no backend.

## Install — pick one

**0. Agent skill (fastest)** — [on skills.sh](https://www.skills.sh/vladzima/copy2llm/copy2llm)

```bash
npx skills add vladzima/copy2llm
```

Installs the [copy2llm skill](skills/copy2llm/SKILL.md) into your coding agent (Claude Code, Cursor, Codex, …) — then just ask it to add the button to your site. Also discoverable at [`/.well-known/agent-skills/index.json`](https://copy.computer/.well-known/agent-skills/index.json).

**1. Script tag (zero build)**

```html
<script src="https://copy.computer/copy2llm.js" defer
        data-position="bottom-right" data-theme="auto"></script>
```

**2. npm (developers)**

```bash
npm i copy2llm-react        # <CopyToLLM /> React component
npm i copy2llm-core         # just extract(document) -> { markdown, title, url }
```

```tsx
import { CopyToLLM } from "copy2llm-react";

export default () => <CopyToLLM position="bottom-right" theme="auto" />;
```

**3. Framer** — install the existing Marketplace plugin for the classic single-page copy/handoff flow. Context Cart, exclusion selectors, and usage events are currently Script/React/widget features; the Framer release is intentionally frozen.

## Packages

| Package | What it is |
|---|---|
| [`copy2llm-core`](packages/core) | The extraction engine: `extract(document, options) → { markdown, title, url }`. Readability + Turndown + GFM. |
| [`copy2llm-widget`](packages/widget) | The Shadow-DOM UI: `mount(options, target?)`. Split button, local Context Cart/review, built-in targets, custom endpoints, and theming. |
| [`copy2llm-react`](packages/react) | `<CopyToLLM />` for React. |
| `copy2llm-snippet` | Self-mounting `<script>` bundle (hosted at copy.computer; not on npm). |
| `copy2llm-framer` | Framer code component. |

## Customization

| Option | What it does | Default |
|---|---|---|
| `position` | `bottom-right` · `bottom-left` · `top-right` · `top-left` · `inline` | `bottom-right` |
| `theme` | `auto` · `light` · `dark` — `auto` matches the **site** (its `color-scheme` / background luminance), falling back to the OS | `auto` |
| `bg` | button background, any CSS color | from theme |
| `text` | button text color, any CSS color | auto-contrast from `bg` |
| `font` | `sans` · `serif` · `mono` | `sans` |
| `radius` | `sharp` · `rounded` · `pill`, or any CSS length | `rounded` |
| `label` | primary button text | `Copy as Markdown` |
| `content` | CSS selector for the extraction root | auto (Readability) |
| `exclude` | CSS selectors removed before extraction; `[data-copy2llm-ignore]` is always removed | none |
| `header` | prepend a title + source header to the Markdown | `true` |
| `items` | actions in order: `copy` · `pick` · `context` · `view` · `chatgpt` · `claude` · `perplexity` · `grok` | all |
| `endpoints` | your own LLM targets — `{ label, href }`, where `href` carries the page Markdown via a `{q}` placeholder | none |
| `prompt` | lead-in text sent before the Markdown on Open in… actions (not in the current Framer release) | a generic "help me work with it" line |
| `onEvent` | React/widget callback receiving privacy-safe action metadata (never content or source URLs) | none |

Script attributes use the matching `data-*` name. Script users can observe the bubbling `copy2llm:action` DOM event; React/widget users can also pass `onEvent`. The current Framer Marketplace release keeps its existing option set.

The Context Cart is local to the tab, capped at 20 sources / 500,000 Markdown characters, and has no account or backend. Token counts are approximate (`characters ÷ 4`).

## Develop

Uses **Bun** (1.3.x) workspaces.

```bash
bun install
bun test                                   # all packages
bun run --filter copy2llm-core build       # one package
bun run build                              # everything
bunx ultracite check .                     # lint
```

## License

MIT
