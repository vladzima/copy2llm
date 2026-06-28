# copy2llm

A **"Copy to LLM" button any website can embed** — the Mintlify/GitBook "Copy page as Markdown" affordance, generalized so any site can add it. On click it converts the current page to clean Markdown and offers to copy it, view it raw, or open it directly in ChatGPT / Claude.

Free in beta · fully client-side · no accounts, no backend.

## Install — pick one

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
| [`copy2llm-widget`](packages/widget) | The button UI in a Shadow DOM: `mount(options, target?)`. Split button, 4 actions, theming. |
| [`copy2llm-react`](packages/react) | `<CopyToLLM />` for React. |
| `copy2llm-snippet` | Self-mounting `<script>` bundle (hosted at copy.computer; not on npm). |
| `copy2llm-framer` | Framer code component. |

## Customization

`position` · `theme` (auto/light/dark) · `bg` · `text` · `font` (sans/serif/mono) · `radius` · `content` (CSS selector for the extraction root) · `header` (frontmatter on/off) · `items` (which of the 4 actions). Identical across the script tag (`data-*`), the React props, and the Framer panel.

`theme: auto` matches the **site** (its `color-scheme` / background luminance), falling back to the OS.

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
