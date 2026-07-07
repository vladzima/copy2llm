# copy2llm

A **"Copy to LLM" button any website can embed** — the Mintlify/GitBook "Copy page as Markdown" affordance, generalized so any site can add it. On click it converts the current page to clean Markdown and offers to copy it, view it raw, or open it directly in ChatGPT, Claude, Perplexity, Grok — or your own custom endpoint.

**Copy just this:** if the visitor has text selected, every action uses the selection instead of the whole page. The "Copy a section" action goes further — hover highlights a block (paragraph, table, code, section), click copies just it. Either way the `> Source:` header deep-links back with a `#anchor`.

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

**3. Framer** — drop in the `copy2llm-framer` code component and configure it from the property panel.

## Packages

| Package | What it is |
|---|---|
| [`copy2llm-core`](packages/core) | The extraction engine: `extract(document, options) → { markdown, title, url }`. Readability + Turndown + GFM. |
| [`copy2llm-widget`](packages/widget) | The button UI in a Shadow DOM: `mount(options, target?)`. Split button, built-in LLM targets + custom endpoints, theming. |
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
| `header` | prepend a title + source header to the Markdown | `true` |
| `items` | which actions show, in order: `copy` · `pick` ("Copy a section") · `view` · `chatgpt` · `claude` · `perplexity` · `grok` | all |
| `endpoints` | your own LLM targets — `{ label, href }`, where `href` carries the page Markdown via a `{q}` placeholder | none |
| `prompt` | lead-in text sent to the LLM before the page's Markdown on the Open in… actions (script tag + React only) | a generic "help me work with it" line |

Identical across the script tag (`data-*`), the React props, and the Framer panel.

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
