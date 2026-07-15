# copy2llm-react

`<CopyToLLM />` — the [copy2llm](https://copy.computer) portable context layer for React.

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

All [`copy2llm-widget`](https://www.npmjs.com/package/copy2llm-widget) options: `content` · `exclude` · `header` · `position` · `theme` · `bg` · `text` · `font` · `radius` · `items` (`copy`, `pick`, `context`, `view`, and AI targets) · `endpoints` · `label` · `prompt` · `onEvent`.

```tsx
<CopyToLLM endpoints={[{ label: "Open in Acme AI", href: "https://acme.ai/?q={q}" }]} />
```

`onEvent` receives privacy-safe metadata only. Context Cart sources remain in same-origin `sessionStorage` for the current tab.

`react >= 17` is a peer dependency.

## License

MIT
