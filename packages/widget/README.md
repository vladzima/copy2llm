# copy2llm-widget

The [copy2llm](https://copy.computer) button UI — a themeable split button rendered in a **Shadow DOM** (two-way CSS isolation), wrapping [`copy2llm-core`](https://www.npmjs.com/package/copy2llm-core). Extraction is lazy (runs on click, so it stays correct in SPAs).

Most people want [`copy2llm-react`](https://www.npmjs.com/package/copy2llm-react) or the `<script>` snippet instead. Use this directly for non-React / imperative mounting.

```bash
npm i copy2llm-widget
```

```ts
import { mount } from "copy2llm-widget";

const handle = mount({ position: "bottom-right", theme: "auto" });
// later:
handle.destroy();
```

```ts
function mount(options?: WidgetOptions, target?: Element): { destroy(): void };
```

## Actions

Split button: **Copy as Markdown** (primary) · **View as Markdown** (overlay) · **Open in ChatGPT / Claude / Perplexity / Grok** · plus any **custom endpoints** you add. A click never does nothing — every failure degrades to something visible (clipboard fallback, "couldn't extract" toast).

## Options

`content` · `header` · `position` · `theme` (auto/light/dark) · `bg` · `text` · `font` (sans/serif/mono) · `radius` · `items` · `endpoints` · `label` · `prompt` (lead-in text sent to the LLM before the page's Markdown on the Open in… actions). `theme: auto` matches the host site, falling back to the OS, and stays live as the site/OS theme changes.

Add your own LLM target (enterprise/internal chat, self-hosted, anything that takes a prompt in the URL):

```ts
mount({
  endpoints: [{ label: "Open in Acme AI", href: "https://acme.ai/?q={q}" }],
});
```

`{q}` is replaced with the page's Markdown (or appended if the template has none); pages too long to inline fall back to a clipboard paste.

## License

MIT
