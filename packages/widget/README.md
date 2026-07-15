# copy2llm-widget

The [copy2llm](https://copy.computer) context-layer UI — a themeable split button and local source review sheet rendered in a **Shadow DOM**, wrapping [`copy2llm-core`](https://www.npmjs.com/package/copy2llm-core). Extraction is lazy, so it stays correct in SPAs.

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

Split button: **Copy as Markdown** · **Copy a section** · **Add to AI context** · **View as Markdown** · built-in/custom AI targets. Context sources persist in `sessionStorage` for the current tab and can be reordered, removed, copied, downloaded, or sent as one Markdown bundle.

## Options

`content` · `exclude` · `header` · `position` · `theme` (auto/light/dark) · `bg` · `text` · `font` (sans/serif/mono) · `radius` · `items` · `endpoints` · `label` · `prompt` · `onEvent`. `exclude` removes CSS matches in addition to the always-on `[data-copy2llm-ignore]` marker. `theme: auto` follows the host site/OS.

Add your own LLM target (enterprise/internal chat, self-hosted, anything that takes a prompt in the URL):

```ts
mount({
  endpoints: [{ label: "Open in Acme AI", href: "https://acme.ai/?q={q}" }],
});
```

`{q}` is replaced with the page's Markdown (or appended if the template has none); pages too long to inline fall back to a clipboard paste.

Every action dispatches a bubbling/composed `copy2llm:action` event. Its detail includes action, success, character count, approximate tokens, and optional target/fallback/item count—never Markdown or source URLs. `onEvent` receives the same detail.

## License

MIT
