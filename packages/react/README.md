# copy2llm-react

`<CopyToLLM />` — the [copy2llm](https://copy.computer) "Copy to LLM" button for React.

```bash
npm i copy2llm-react
```

```tsx
import { CopyToLLM } from "copy2llm-react";

export default function App() {
  return <CopyToLLM position="bottom-right" theme="auto" />;
}
```

Mounts the Shadow-DOM widget on mount and tears it down on unmount. `position="inline"` renders an in-flow anchor and mounts there; any other position mounts onto `document.body` and renders nothing.

## Props

All [`copy2llm-widget`](https://www.npmjs.com/package/copy2llm-widget) options: `content` · `header` · `position` · `theme` (auto/light/dark) · `bg` · `text` · `font` (sans/serif/mono) · `radius` · `items` (copy, view, ChatGPT, Claude, Perplexity, Grok) · `endpoints` (your own LLM targets — `{ label, href }`) · `label` · `prompt` (lead-in text sent to the LLM before the page's Markdown on the Open in… actions).

```tsx
<CopyToLLM endpoints={[{ label: "Open in Acme AI", href: "https://acme.ai/?q={q}" }]} />
```

`react >= 17` is a peer dependency.

## License

MIT
