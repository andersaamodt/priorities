#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd -P)
tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/priorities-name-validation.XXXXXX")
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT HUP INT TERM

run_backend() {
  PRIORITIES_ATTR_BACKEND=sidecar sh "$ROOT/scripts/priorities-backend.sh" "$@"
}

run_backend add "$tmp_dir" "Good Task.md" >/dev/null
test -f "$tmp_dir/Good Task.md"

if run_backend add "$tmp_dir" "../Escaped.md" >/tmp/priorities-name-validation.out 2>/tmp/priorities-name-validation.err; then
  printf '%s\n' "test-backend-name-validation: add accepted parent traversal" >&2
  exit 1
fi
test ! -e "$tmp_dir/../Escaped.md"
grep -q 'must not include path separators' /tmp/priorities-name-validation.err

if run_backend add "$tmp_dir" "." >/tmp/priorities-name-validation.out 2>/tmp/priorities-name-validation.err; then
  printf '%s\n' "test-backend-name-validation: add accepted dot name" >&2
  exit 1
fi
grep -q 'invalid priority name' /tmp/priorities-name-validation.err

if run_backend add "$tmp_dir" "Bad	Tab.md" >/tmp/priorities-name-validation.out 2>/tmp/priorities-name-validation.err; then
  printf '%s\n' "test-backend-name-validation: add accepted control character" >&2
  exit 1
fi
grep -q 'must be a single filename' /tmp/priorities-name-validation.err

if run_backend rename "$tmp_dir/Good Task.md" "../Renamed.md" >/tmp/priorities-name-validation.out 2>/tmp/priorities-name-validation.err; then
  printf '%s\n' "test-backend-name-validation: rename accepted parent traversal" >&2
  exit 1
fi
test -f "$tmp_dir/Good Task.md"
grep -q 'must not include path separators' /tmp/priorities-name-validation.err

rm -f /tmp/priorities-name-validation.out /tmp/priorities-name-validation.err
printf '%s\n' "test-backend-name-validation: ok"
