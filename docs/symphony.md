# Symphony Setup

This project has a repo-owned Symphony workflow in `WORKFLOW.md`. It is adapted from OpenAI's experimental Symphony Elixir implementation and is meant for trusted local automation.

## What Is Wired

- Linear tracker configuration with the expected active and terminal states.
- Per-issue workspaces under `~/code/waterbarons-basin-run-symphony-workspaces`.
- Workspace bootstrap from `https://github.com/ericfode/water-barons.git` by default.
- Optional alternate bootstrap through `SYMPHONY_SOURCE_REPO`.
- Project gates: `npm run test` and `npm run build`.
- Local Codex skills under `.codex/skills` for Linear, commit, pull, push, and land flows.
- A start helper at `scripts/start-symphony.sh`.

## Required Before First Run

1. Replace `TODO-linear-project-slug` in `WORKFLOW.md` with the Linear project slug.
2. Export a Linear personal API key:

```bash
export LINEAR_API_KEY=...
```

3. Install `mise`, because the upstream Symphony reference uses it to install Elixir and Erlang:

```bash
brew install mise
```

4. Confirm Codex is available:

```bash
codex app-server --help
```

5. For full PR automation, confirm this checkout has a pushable GitHub remote:

```bash
git remote -v
```

By default Symphony clones `https://github.com/ericfode/water-barons.git`. Override `SYMPHONY_SOURCE_REPO` only when testing against a fork or alternate remote.

## Run

```bash
scripts/start-symphony.sh
```

The helper clones or updates OpenAI Symphony at `${SYMPHONY_CHECKOUT_DIR:-$HOME/src/openai-symphony}`, builds the Elixir escript, and runs:

```bash
./bin/symphony /Users/ericfode/Documents/New\ project/WORKFLOW.md --logs-root /Users/ericfode/Documents/New\ project/.symphony/log --port 4077
```

When running, the dashboard is available at <http://127.0.0.1:4077>.

## Linear Workflow States

The default workflow expects these state names:

- `Todo`
- `In Progress`
- `Human Review`
- `Rework`
- `Merging`
- `Done`

If the Linear team uses different names, update `WORKFLOW.md` and the prompt's state flow together.

## Trust Posture

This setup uses `approval_policy: never`, `workspace-write`, and network access for Codex turns so unattended agents can install, test, push, and use hosted APIs inside issue workspaces. Keep the workspace root outside the repo, keep secrets in the environment, and run only against tickets you are comfortable letting an autonomous agent execute.
