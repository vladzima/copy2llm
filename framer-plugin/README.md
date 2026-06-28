# Copy to LLM Button — Framer plugin

A Framer plugin that installs the [Copy to LLM](https://copy.computer) button on
every published page of your site. Configure position, theme, colors, font,
label, and menu actions with a live preview, then click **Add to site** — the
plugin injects the `copy.computer/copy2llm.js` snippet via Framer Custom Code
(`bodyEnd`). **Remove from site** clears it.

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

The button is the production snippet, configured through `data-*` attributes
that mirror `copy2llm-widget`'s `parseDataset` contract. `src/snippet.ts` builds
the exact `<script>` tag (emitting `data-*` only for non-default values and
escaping attribute values); `src/App.tsx` wires the UI to `framer.setCustomCode`.
