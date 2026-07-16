# copy2llm — agent workflow

Plain git. GitButler was dropped from this repo on 2026-07-07 — do **not** use `but` commands here.

## Multi-session rules

Several agent sessions may work on this repo in parallel (each in its own worktree).

- Work in your own worktree on your own branch, created from `origin/main`.
- Commit early and often — uncommitted work is invisible to other sessions and tools.
- Never touch refs you don't own. Once your branch is pushed or shared, treat it as append-only (no rebase/amend) unless the user asks.
- Landing = fast-forward merge into `main` (rebase onto `origin/main` first if it moved), then push. Only land when the user approves.
- Stay off shared surfaces unless your task owns them: the README options table, `skills/copy2llm/SKILL.md` options table, `bun.lock`, version fields. Parallel edits there conflict.

## Build / test

Bun workspaces (pnpm is broken on this machine): `bun install`, `bun run build`, `bun test`, `bun run typecheck`, `bun run lint`.

Inter-package imports resolve to **built dists** — run `bun run build` after cloning and after switching branches, or tests fail with "Cannot find package". The snippet and framer-plugin inline BUILT dists of their deps: rebuild dependencies first (widget before snippet, snippet before framer-plugin), and grep `plugin.zip` for a new-feature string before shipping it.

## Parity rule

Every new widget option must reach snippet (`data-*`), React props, and the landing configurator (`apps/site/public/index.html`) plus the docs tables (README, SKILL.md, package READMEs) in the same change. Framer surfaces are opt-in per feature — ask if unsure.

## Framer freeze

The Framer Marketplace plugin and `copy2llm-framer` package are intentionally frozen because even small Marketplace updates trigger a costly review. Do not edit, rebuild, repack, or publish either Framer surface unless the user explicitly lifts this freeze for the task. New non-Framer features must be documented as unavailable in the current Framer release.

For landing-only changes, do not run the root `bun run build`: it also rebuilds the frozen Framer workspaces. The static site has no build step; run the repository tests, typecheck, and lint instead.

## Landing page UI conventions

`apps/site/public/index.html` is intentionally self-contained. Keep its existing plain HTML/CSS/JS architecture and use the shared CSS tokens instead of introducing another styling system.

- Use the semantic `--text-*` scale, balanced headings, pretty-wrapped descriptions, and a sequential `h1` → `h2` → `h3` outline.
- Interactive targets are at least `40px` on desktop and `44px` on mobile. Inputs stay `16px` on mobile to prevent iOS focus zoom.
- Press feedback uses `scale(0.96)`. Transition only named properties; never use `transition: all`.
- Dark elevated surfaces use the `--shadow-border*` rings. Nested radii stay concentric, and images use an inset pure-white `oklch(1 0 0 / 0.1)` outline.
