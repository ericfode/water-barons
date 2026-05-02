#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

WORKFLOW_FILE="${SYMPHONY_WORKFLOW:-$PROJECT_ROOT/WORKFLOW.md}"
CHECKOUT_DIR="${SYMPHONY_CHECKOUT_DIR:-$HOME/src/openai-symphony}"
LOGS_ROOT="${SYMPHONY_LOGS_ROOT:-$PROJECT_ROOT/.symphony/log}"
PORT="${SYMPHONY_PORT:-4077}"

if ! command -v codex >/dev/null 2>&1; then
  echo "codex is required on PATH." >&2
  exit 1
fi

if ! command -v mise >/dev/null 2>&1; then
  echo "mise is required. Install with: brew install mise" >&2
  exit 1
fi

if [ -z "${LINEAR_API_KEY:-}" ]; then
  echo "LINEAR_API_KEY is required for Symphony's Linear tracker." >&2
  exit 1
fi

if grep -q 'TODO-linear-project-slug' "$WORKFLOW_FILE"; then
  echo "Replace TODO-linear-project-slug in $WORKFLOW_FILE before running Symphony." >&2
  exit 1
fi

mkdir -p "$(dirname "$CHECKOUT_DIR")" "$LOGS_ROOT"

if [ ! -d "$CHECKOUT_DIR/.git" ]; then
  git clone https://github.com/openai/symphony "$CHECKOUT_DIR"
else
  git -C "$CHECKOUT_DIR" pull --ff-only
fi

cd "$CHECKOUT_DIR/elixir"
mise trust
mise install
mise exec -- mix setup
mise exec -- mix build

exec mise exec -- ./bin/symphony "$WORKFLOW_FILE" --logs-root "$LOGS_ROOT" --port "$PORT"
