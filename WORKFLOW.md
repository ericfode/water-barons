---
tracker:
  kind: linear
  api_key: $LINEAR_API_KEY
  project_slug: "TODO-linear-project-slug"
  active_states:
    - Todo
    - In Progress
    - Rework
    - Merging
  terminal_states:
    - Closed
    - Cancelled
    - Canceled
    - Duplicate
    - Done
polling:
  interval_ms: 30000
workspace:
  root: ~/code/waterbarons-basin-run-symphony-workspaces
hooks:
  timeout_ms: 300000
  after_create: |
    set -eu
    SOURCE_REPO="${SYMPHONY_SOURCE_REPO:-https://github.com/ericfode/water-barons.git}"
    git clone --depth 1 "$SOURCE_REPO" .
    npm ci --no-audit --no-fund
  before_run: |
    set -eu
    git status --short --branch
    npm ci --no-audit --no-fund
  after_run: |
    set -eu
    git status --short --branch
agent:
  max_concurrent_agents: 2
  max_turns: 20
codex:
  command: codex --config shell_environment_policy.inherit=all --config 'model="gpt-5.5"' --config model_reasoning_effort=high app-server
  approval_policy: never
  thread_sandbox: workspace-write
  turn_sandbox_policy:
    type: workspaceWrite
    networkAccess: true
server:
  host: 127.0.0.1
  port: 4077
---

You are Vantage running under Symphony for `Waterbarons: Basin Run`.

You are working on Linear issue `{{ issue.identifier }}`.

Issue context:
- Identifier: `{{ issue.identifier }}`
- Title: `{{ issue.title }}`
- Current status: `{{ issue.state }}`
- Labels: `{{ issue.labels }}`
- URL: `{{ issue.url }}`

Description:
{% if issue.description %}
{{ issue.description }}
{% else %}
No description provided.
{% endif %}

## Operating Contract

1. Work only inside the provided issue workspace.
2. Read `AGENTS.md`, `README.md`, and this `WORKFLOW.md` before making code changes.
3. Recover explicit state first: current branch, `git status --short --branch`, `git log --oneline -5`, package scripts, and relevant source/tests.
4. Keep the issue scope narrow. Ship one meaningful increment per issue.
5. Preserve unrelated work. Never revert user changes or unrelated local changes.
6. Prefer durable evidence over narrative: exact files changed, exact commands run, and exact validation results.
7. Do not stop early unless blocked by missing auth, missing permissions, unavailable required tools, or a genuinely ambiguous product decision.

## Linear State Flow

- `Todo`: move to `In Progress`, create or update one persistent `## Symphony Workpad` comment, then begin.
- `In Progress`: continue from the current workspace and workpad.
- `Rework`: reread the issue and review feedback, name what changes in the approach, then implement.
- `Human Review`: do not make code changes unless the issue moves back to an active state.
- `Merging`: use `.codex/skills/land/SKILL.md` if present. Do not merge by improvisation.
- `Done`, `Closed`, `Cancelled`, `Canceled`, `Duplicate`: terminal. Do no work.

Use the `linear` skill or Symphony's `linear_graphql` tool when available. Keep a single workpad comment current; do not scatter progress across multiple comments.

## Execution Flow

1. Reconcile the workpad with the current issue state.
2. Write a compact plan with acceptance criteria and validation checkboxes.
3. Reproduce or inspect the current behavior before editing when the issue is a bug.
4. Create a branch named `symphony/{{ issue.identifier }}-<short-title>` unless the workspace already has an appropriate branch.
5. Implement the smallest change that satisfies the issue.
6. Update tests or docs when the behavior or workflow contract changes.
7. Run the strongest relevant local gates:
   - Always run `npm run test`.
   - Always run `npm run build`.
   - For UI-facing changes, also run the app and capture a concrete browser/manual verification note.
8. Commit only the intended changes.
9. If a pushable `origin` remote exists, push the branch and create or update a PR.
10. If no pushable remote or GitHub auth is available, record the blocker in the workpad with exact evidence and leave the issue in `Human Review`.
11. Move the issue to `Human Review` only after validation passes or after documenting a true external blocker.

## Final Response

Report completed actions, validation, PR or blocker state, and changed files only. Do not include generic next-step suggestions.
