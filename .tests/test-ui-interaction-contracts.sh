#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd -P)
INDEX="$ROOT/index.html"
STYLE="$ROOT/style.css"

require_index() {
  pattern=$1
  message=$2
  if ! grep -q "$pattern" "$INDEX"; then
    printf '%s\n' "test-ui-interaction-contracts: missing index contract: $message" >&2
    exit 1
  fi
}

require_style() {
  pattern=$1
  message=$2
  if ! grep -q "$pattern" "$STYLE"; then
    printf '%s\n' "test-ui-interaction-contracts: missing style contract: $message" >&2
    exit 1
  fi
}

node -e '
const fs = require("fs");
const html = fs.readFileSync(process.argv[1], "utf8");
const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .filter((script) => script.trim());
for (const script of scripts) {
  new Function(script);
}
' "$INDEX"

require_index 'state.pendingTrashUndo' 'pending trash state exists'
require_index 'nextItems = nextItems.filter' 'pending trash items stay filtered during list refresh'
require_index 'cloneDirItems(cachedParentItems)' 'delete undo snapshots clone cached items'
require_index 'function collapseExpanded(path)' 'collapse has an animation-aware path'
require_index 'function clearProjectChildrenEnter(path)' 'project expansion classes are cleaned after animation'
require_index 'project-children-enter' 'expanded project rows mark enter animation'
require_index 'data-parent-path' 'project child groups are identifiable for collapse'

require_style '\.project-children-enter' 'project expansion animation class'
require_style '@keyframes project-children-enter' 'project expansion keyframes'
require_style '@keyframes project-children-exit' 'project collapse keyframes'
require_style 'prefers-reduced-motion: reduce' 'reduced-motion guard for project animations'

printf '%s\n' "test-ui-interaction-contracts: ok"
