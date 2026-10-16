#!/bin/sh
# Run the Impeccable pre-edit check only when an engine binary is already
# installed. The launcher downloads one on a miss, which does not fit the
# hook's timeout.
set -eu

s=.cursor/skills/impeccable/scripts/impeccable
[ -f "$s" ] || exit 0

d=$(CDPATH= cd -- "$(dirname -- "$s")" && pwd)
v=$(tr -d '[:space:]' < "$d/VERSION")

case "$(uname -s 2>/dev/null || echo unknown)" in
  Darwin) os=darwin ;;
  Linux) os=linux ;;
  MINGW*|MSYS*|CYGWIN*|Windows_NT) os=windows ;;
  *) os=unknown ;;
esac
case "$(uname -m 2>/dev/null || echo unknown)" in
  arm64|aarch64) arch=arm64 ;;
  x86_64|amd64) arch=x64 ;;
  *) arch=unknown ;;
esac

exe=""
[ "$os" = windows ] && exe=".exe"
sibling="$d/bin/$os-$arch/impeccable$exe"
cache="${IMPECCABLE_HOME:-${HOME:-/nonexistent}/.impeccable}/bin/$v/impeccable$exe"
home_bin="${HOME:-/nonexistent}/.impeccable/bin/impeccable$exe"

probes_ok() {
  [ -n "${1:-}" ] && [ -x "$1" ] || return 1
  case "$(IMPECCABLE_LAUNCHER_PROBE=1 "$1" engine-probe 2>/dev/null || true)" in
    impeccable-engine*) return 0 ;;
  esac
  return 1
}

# Follow the launcher's candidate order. Call it only when the candidate it
# would execute answers engine-probe. A failed probe must not fall through
# into the launcher, because that is the path that downloads.
if [ -n "${IMPECCABLE_BIN:-}" ] && [ -x "${IMPECCABLE_BIN}" ]; then
  probes_ok "${IMPECCABLE_BIN}" || exit 0
  exec "$s" hook-before-edit
fi

if [ -x "$sibling" ]; then
  probes_ok "$sibling" || exit 0
  exec "$s" hook-before-edit
elif [ -f "$sibling" ] && chmod +x "$sibling" 2>/dev/null && [ -x "$sibling" ]; then
  probes_ok "$sibling" || exit 0
  exec "$s" hook-before-edit
fi

if probes_ok "$home_bin"; then
  exec "$s" hook-before-edit
fi

if [ -n "$v" ] && [ -x "$cache" ]; then
  probes_ok "$cache" || exit 0
  exec "$s" hook-before-edit
fi

path_bin=$(command -v impeccable 2>/dev/null || true)
if probes_ok "$path_bin"; then
  exec "$s" hook-before-edit
fi

exit 0
