#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/symphony-elixir.sh [--prepare-only] [symphony args...]

Required environment:
  LINEAR_API_KEY                  Linear personal API key, or set in ~/.config/symphony/env.
  SYMPHONY_LINEAR_PROJECT_SLUG    Linear project slug to poll.
  SYMPHONY_ACCEPT_PREVIEW_RISK=1  Acknowledge Symphony's unguarded preview mode.

Optional environment:
  SYMPHONY_ENV_FILE               Secret env file. Default: ~/.config/symphony/env
  SYMPHONY_ELIXIR_ROOT            Shared upstream clone. Default: /Users/ericfode/src/openai-symphony
  SYMPHONY_WORKSPACE_ROOT         Agent workspaces. Default: .symphony/workspaces
  SYMPHONY_LOGS_ROOT              Symphony logs. Default: .symphony/logs
  SYMPHONY_PORT                   Dashboard/API port. Default: WORKFLOW.md server.port
  SYMPHONY_SOURCE_ROOT            Source snapshot root. Default: current repo root
  SYMPHONY_SKIP_BUILD=1           Skip mix setup/build.

The script clones or updates openai/symphony, builds elixir/, generates a workflow
with the Linear project slug filled in, and starts ./bin/symphony. Use
--prepare-only to stop after clone/build/workflow generation.
EOF
}

die() {
  echo "error: $*" >&2
  exit 1
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

prepare_only=0
if [[ "${1:-}" == "--prepare-only" ]]; then
  prepare_only=1
  shift
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
symphony_env_file="${SYMPHONY_ENV_FILE:-$HOME/.config/symphony/env}"

if [[ -f "$symphony_env_file" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$symphony_env_file"
  set +a
fi

command -v git >/dev/null 2>&1 || die "git is required"
command -v codex >/dev/null 2>&1 || die "codex is required"
command -v rsync >/dev/null 2>&1 || die "rsync is required"

[[ "${SYMPHONY_ACCEPT_PREVIEW_RISK:-}" == "1" ]] ||
  die "set SYMPHONY_ACCEPT_PREVIEW_RISK=1 to acknowledge Symphony preview mode"
[[ -n "${LINEAR_API_KEY:-}" ]] || die "LINEAR_API_KEY is required"
[[ -n "${SYMPHONY_LINEAR_PROJECT_SLUG:-}" ]] || die "SYMPHONY_LINEAR_PROJECT_SLUG is required"

export SYMPHONY_SOURCE_ROOT="${SYMPHONY_SOURCE_ROOT:-$repo_root}"
export SYMPHONY_WORKSPACE_ROOT="${SYMPHONY_WORKSPACE_ROOT:-$repo_root/.symphony/workspaces}"

symphony_root="${SYMPHONY_ELIXIR_ROOT:-/Users/ericfode/src/openai-symphony}"
logs_root="${SYMPHONY_LOGS_ROOT:-$repo_root/.symphony/logs}"
workflow_template="${SYMPHONY_WORKFLOW_TEMPLATE:-$repo_root/WORKFLOW.md}"
generated_workflow="$repo_root/.symphony/WORKFLOW.generated.md"

mkdir -p "$(dirname "$symphony_root")" "$SYMPHONY_WORKSPACE_ROOT" "$logs_root" "$(dirname "$generated_workflow")"

if [[ ! -d "$symphony_root/.git" ]]; then
  git clone --depth 1 https://github.com/openai/symphony "$symphony_root"
else
  git -C "$symphony_root" fetch --depth 1 origin main
  git -C "$symphony_root" checkout -q main
  git -C "$symphony_root" reset -q --hard origin/main
fi

[[ -f "$workflow_template" ]] || die "workflow template not found: $workflow_template"
escaped_slug="$(printf '%s' "$SYMPHONY_LINEAR_PROJECT_SLUG" | sed 's/[\/&]/\\&/g')"
sed "s/__SYMPHONY_LINEAR_PROJECT_SLUG__/${escaped_slug}/g" "$workflow_template" > "$generated_workflow"

cd "$symphony_root/elixir"

if [[ "${SYMPHONY_SKIP_BUILD:-}" != "1" ]]; then
  if command -v mise >/dev/null 2>&1; then
    mise trust
    mise install
    mise exec -- mix setup
    mise exec -- mix build
  elif command -v mix >/dev/null 2>&1; then
    mix setup
    mix build
  else
    die "mise or mix is required to build the Elixir implementation"
  fi
fi

cmd=(
  ./bin/symphony
  --i-understand-that-this-will-be-running-without-the-usual-guardrails
  --logs-root "$logs_root"
)

if [[ -n "${SYMPHONY_PORT:-}" ]]; then
  cmd+=(--port "$SYMPHONY_PORT")
fi

cmd+=("$@")
cmd+=("$generated_workflow")

if [[ "$prepare_only" == "1" ]]; then
  echo "prepared Symphony Elixir at $symphony_root"
  echo "generated workflow at $generated_workflow"
  echo "workspace root is $SYMPHONY_WORKSPACE_ROOT"
  exit 0
fi

if command -v mise >/dev/null 2>&1; then
  exec mise exec -- "${cmd[@]}"
else
  exec "${cmd[@]}"
fi
