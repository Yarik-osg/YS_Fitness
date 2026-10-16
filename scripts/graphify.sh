#!/bin/sh
# Run the patched Graphify checkout against this repo.
# Output stays in graphify-out/, which .gitignore already excludes.
# The global `graphify` on PATH is a separate install and does not see the Prisma patch.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
BIN=/Users/roxyreg/graphify/.venv/bin/graphify
PY=/Users/roxyreg/graphify/.venv/bin/python

if [ ! -x "$BIN" ] || [ ! -x "$PY" ]; then
  echo "Patched Graphify checkout is not executable at $BIN" >&2
  exit 1
fi

if ! "$PY" -c "from graphify.cache import _AST_CACHE_SCHEMA; raise SystemExit(0 if _AST_CACHE_SCHEMA >= 18 else 1)"; then
  echo "Patched Graphify at $PY is older than AST cache schema 18" >&2
  exit 1
fi

cd "$ROOT"
mkdir -p graphify-out
printf '%s\n' "$PY" > graphify-out/.graphify_python

if [ "$#" -eq 0 ]; then
  echo "Usage: scripts/graphify.sh extract . --code-only --force" >&2
  echo "       scripts/graphify.sh cluster-only ." >&2
  echo "       scripts/graphify.sh update ." >&2
  echo "       scripts/graphify.sh query \"<question>\"" >&2
  echo "       scripts/graphify.sh path \"<A>\" \"<B>\"" >&2
  echo "       scripts/graphify.sh explain \"<concept>\"" >&2
  exit 2
fi

exec "$BIN" "$@"
