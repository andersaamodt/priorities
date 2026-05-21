#!/bin/sh
set -eu

workflow=.github/workflows/build-artifacts.yml
test -f "$workflow"

grep -q '^  push:' "$workflow"
grep -q 'repository: andersaamodt/wizardry-apps' "$workflow"

for job in 'Build Linux AppImage' 'Build macOS App' 'Build Android APK' 'Build iOS Simulator App'; do
  grep -q "name: $job" "$workflow"
done

for artifact in priorities-linux priorities-macos priorities-android priorities-ios; do
  grep -q "name: $artifact" "$workflow"
done

grep -q 'stage-web-assets.sh priorities' "$workflow"
grep -q 'prepare-android-host.sh priorities-mobile' "$workflow"
grep -q 'build-ios-app.sh priorities-mobile' "$workflow"
