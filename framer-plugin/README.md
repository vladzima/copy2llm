# Copy to LLM Button — Framer plugin

A Framer plugin that installs the [Copy to LLM](https://copy.computer) button on
every published page of your site. Configure position, theme, colors, font,
label, menu actions (ChatGPT, Claude, Perplexity, Grok), and your own custom
endpoints with a live preview, then click **Add to site** — the plugin writes
an inline `<script>` carrying the bundled Copy to LLM widget via Framer Custom
Code (`bodyEnd`). **Remove from site** clears it.

The widget code is **inlined**, not loaded from a URL: the `copy2llm` IIFE is
baked into the plugin bundle at build time (`copy2llm-snippet`'s
`dist/copy2llm.global.js`, imported with Vite's `?raw`) and written verbatim
into the site. So the executed code is exactly what the Marketplace reviewed and
can't change after publication.

This is the editor plugin. For an on-canvas component, see the
`copy2llm-framer` code component.

## Develop

```bash
npm install
npm run dev          # then "Open Development Plugin" in Framer (Developer Tools on)
```

## Test / typecheck

```bash
npm run typecheck
npm test             # bun test — covers the snippet builder
```

## Publish

```bash
npm run pack         # writes plugin.zip
```

Upload `plugin.zip` in the Framer Marketplace dashboard (**New Plugin**). See
https://www.framer.com/developers/publishing.

## How it works

The button is the production widget, configured through `data-*` attributes that
mirror `copy2llm-widget`'s `parseDataset` contract — read from
`document.currentScript.dataset`, which works for an inline script just as it did
for the remote one. `src/snippet.ts` builds the inline `<script>` (the widget
source as its body, `data-*` only for non-default values, attribute values and
any literal `</script` escaped); `src/app.tsx` passes in the bundled source and
wires the UI to `framer.setCustomCode`.
