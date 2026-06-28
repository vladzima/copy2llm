# copy2llm-core

The extraction engine behind [copy2llm](https://copy.computer) — turns a live DOM into clean Markdown. Pure and framework-agnostic: **DOM in, Markdown out, no UI, no network.**

```bash
npm i copy2llm-core
```

```ts
import { extract } from "copy2llm-core";

const { markdown, title, url } = extract(document, {
  content: "main",  // optional CSS selector for the content root; defaults to auto-detect
  header: true,     // prepend "# {title}\n\n> Source: {url}" (default true)
});
```

```ts
interface ExtractResult { markdown: string; title: string; url: string }
```

## How it works

Runs on a **clone** of the page (never mutates the input document):

1. Pick the content root — author selector → [Readability](https://github.com/mozilla/readability) auto-detect → `<main>`/`<article>`/`<body>` fallback.
2. Promote lazy images (`data-src`/`srcset` → `src`), normalize ragged tables, absolutize relative URLs.
3. Convert HTML → Markdown via [Turndown](https://github.com/mixmark-io/turndown) + GFM, with token-bomb guards (giant `data:` URIs) and fence-aware whitespace cleanup.
4. Prepend the title + source header.

## License

MIT
