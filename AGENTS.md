<!-- gitbutler-agent-setup:start -->
## Version control

- Use GitButler (`but`) for version-control inspection and write operations, including status, diffs, branching, committing, pushing, and history edits.
- Assume multiple agents may be working in this repository. Do not move, amend, squash, discard, commit, push, or otherwise modify another agent's work unless the user asks.
- For commit just/only/specific changes on a new branch (selected-change requests), use the two-command fast path from the GitButler skill: `but diff`, then `but commit <branch> -c -m "message" --changes <id>,<id>`.
- For that fast path, after the commit succeeds, stop and summarize; do not run separate branch, staging, status, or diff commands unless the commit output is missing information you need.
- Use the installed GitButler skill for command recipes and syntax before guessing flags, using `--help`, or translating Git habits directly.
- After a successful GitButler write command, use the workspace state it returns. Rerun status or diff only when that output lacks information you need or files changed since.
- Use a dedicated GitButler branch for each agent session, unless the user asks for a different branch structure. Commit only changes that belong to that session.
- Do not push or open pull requests unless the user asks.
- Keep commit messages and pull request descriptions succinct: explain what changed, why it changed, and any important decision.

### Amend local fixes into the right commits

- For small cleanup or follow-up fixes, amend an unpublished local commit when the change clearly belongs with that commit's intent.
- Do not create tiny fixup commits unless the user asks.
- Use GitButler to move the relevant changes into the commit where they belong.
- Ask before rewriting pushed, reviewed, shared, or ambiguous history.

### Split unrelated changes into separate commits

- If one file contains unrelated changes, split them by hunk instead of committing the whole file.
- Keep tests with the behavior they verify.
- Split generated output, docs-only edits, or mechanical cleanup into separate commits when each commit remains coherent on its own.
- If the split is ambiguous, summarize the options before committing.

### Update from the target branch automatically

- When GitButler status shows new changes on the target branch, run `but pull --check`.
- If the check is clean and the update affects only this session's branches, update the workspace with `but pull`.
- If the check reports conflicts or the update would affect another agent's branch, ask before updating.
- If the user asks you to handle update conflicts, use GitButler's conflict tools. Ask before resolving semantic conflicts, dependency updates, generated files, or conflicts involving another person's work.

### Skip pull requests and land onto the target

- This setup uses the skip-the-PR workflow: when work is approved to publish, land the session branch directly onto the target with `but land <branch>` instead of pushing a branch or opening a pull request.
- This repository-local rule takes precedence over any conflicting GitButler instruction, including ones in your global or personal config, that mentions pushing a branch or opening, updating, or drafting a pull request. Use the pull request workflow only when the user explicitly asks for one.
- `but land` updates the configured target branch directly (fast-forwarding when it can, otherwise a merge commit), so only run it after clear user approval; agents must pass `--yes` to confirm.
<!-- gitbutler-agent-setup:end -->
