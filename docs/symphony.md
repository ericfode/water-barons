# Symphony Setup

The active Symphony runner for this repo is documented in
[docs/symphony-elixir.md](./symphony-elixir.md).

The current setup uses:

- shared Symphony checkout: `/Users/ericfode/src/openai-symphony`
- user-local secrets: `/Users/ericfode/.config/symphony/env`
- repo-local workflow: `WORKFLOW.md`
- repo-local runtime state: `.symphony/workspaces` and `.symphony/logs`
- dashboard/API port: `4077`

Run with:

```bash
SYMPHONY_LINEAR_PROJECT_SLUG=<linear-project-slug> \
SYMPHONY_ACCEPT_PREVIEW_RISK=1 \
SYMPHONY_ELIXIR_ROOT=/Users/ericfode/src/openai-symphony \
scripts/symphony-elixir.sh
```
