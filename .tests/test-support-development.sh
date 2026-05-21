#!/bin/sh
set -eu

grep -q 'Support Development' index.html
grep -q 'data-support-dev-action="createTask"' index.html
grep -q 'data-support-dev-action="completeTask"' index.html
grep -q 'data-support-dev-action="reprioritizeTask"' index.html
grep -q "triggerSupportDevZap('createTask'" index.html
grep -q "triggerSupportDevZap('completeTask'" index.html
grep -q "triggerSupportDevZap('reprioritizeTask'" index.html
grep -q 'send-support-zap' scripts/priorities-backend.sh
test -x scripts/support-dev-zap.mjs

if command -v node >/dev/null 2>&1; then
  node scripts/support-dev-zap.mjs --self-test >/dev/null
fi
