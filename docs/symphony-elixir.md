# Symphony Elixir Setup

This repository is configured to run against the Elixir reference implementation from
[`openai/symphony`](https://github.com/openai/symphony).

## Files

- `WORKFLOW.md` is the repo-owned Symphony contract for `Waterbarons: Basin Run`.
- `scripts/symphony-elixir.sh` uses the shared `openai/symphony` checkout at
  `/Users/ericfode/src/openai-symphony` by default, builds the Elixir implementation,
  fills the Linear project slug into a generated workflow, and starts Symphony.
- `.codex/skills/` contains the optional Symphony skills adapted for this project's
  validation and handoff flow.
- `.symphony/` is ignored project-local runtime state for the generated workflow,
  logs, and isolated workspaces.

## Requirements

- `codex`
- `git`
- `rsync`
- `LINEAR_API_KEY`, either in the environment or in `/Users/ericfode/.config/symphony/env`
- `SYMPHONY_LINEAR_PROJECT_SLUG`
- `SYMPHONY_ACCEPT_PREVIEW_RISK=1`
- `mise` with the upstream `elixir/mise.toml`, or a compatible local `mix`/Elixir
  runtime

Symphony's current workflow schema expands `$LINEAR_API_KEY`, but not
`tracker.project_slug`. The runner script handles that by generating
`.symphony/WORKFLOW.generated.md` from `WORKFLOW.md`.

## Run

The runner sources `/Users/ericfode/.config/symphony/env` before checking required
variables. That file is user-local and must not be committed to any project.

```bash
cd /Users/ericfode/Documents/New\ project
SYMPHONY_LINEAR_PROJECT_SLUG=<linear-project-slug> \
SYMPHONY_ACCEPT_PREVIEW_RISK=1 \
SYMPHONY_ELIXIR_ROOT=/Users/ericfode/src/openai-symphony \
scripts/symphony-elixir.sh
```

Optional settings:

```bash
SYMPHONY_ENV_FILE=/path/to/private/env
SYMPHONY_PORT=4077
SYMPHONY_ELIXIR_ROOT=/Users/ericfode/src/openai-symphony
SYMPHONY_WORKSPACE_ROOT=/path/to/workspaces
SYMPHONY_LOGS_ROOT=/path/to/logs
SYMPHONY_SOURCE_ROOT=/Users/ericfode/Documents/New\ project
SYMPHONY_SKIP_BUILD=1
```

The script passes Symphony's required preview acknowledgement flag only when
`SYMPHONY_ACCEPT_PREVIEW_RISK=1` is set.

To verify clone and workflow generation without starting the daemon:

```bash
SYMPHONY_LINEAR_PROJECT_SLUG=waterbarons \
SYMPHONY_ACCEPT_PREVIEW_RISK=1 \
SYMPHONY_SKIP_BUILD=1 \
scripts/symphony-elixir.sh --prepare-only
```

No `LINEAR_API_KEY` needs to be exported in this repo if
`/Users/ericfode/.config/symphony/env` contains it.

## Workspace Behavior

Each issue gets an isolated workspace populated from the current source checkout with
`.git`, `.symphony`, `node_modules`, `dist`, and Vite cache output excluded. The
workspace is initialized as a fresh local git repository so agents can commit their
result even when the source checkout has no clean publish path.

Default project gates in `WORKFLOW.md`:

```bash
npm run test
npm run build
```

## Operational Rule

Use one shared Symphony code checkout and one daemon process per project. Each project
owns its own `WORKFLOW.md`, `.symphony/workspaces`, `.symphony/logs`, and dashboard
port.
