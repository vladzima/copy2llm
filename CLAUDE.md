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
