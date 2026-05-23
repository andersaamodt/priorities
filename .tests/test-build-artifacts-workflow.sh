#!/bin/sh
set -eu

workflow=.github/workflows/build-artifacts.yml
test -f "$workflow"

grep -q '^  push:' "$workflow"
grep -q '^  release:' "$workflow"
grep -q 'repository: andersaamodt/wizardry-apps' "$workflow"
grep -q 'contents: write' "$workflow"

for job in 'Build Linux AppImage' 'Build macOS App' 'Build Android APK' 'Build iOS Simulator App'; do
  grep -q "name: $job" "$workflow"
done

for artifact in priorities-linux priorities-macos priorities-android priorities-ios; do
  grep -q "name: $artifact" "$workflow"
done

grep -q 'stage-web-assets.sh priorities' "$workflow"
grep -q 'prepare-android-host.sh priorities-mobile' "$workflow"
grep -q 'build-ios-app.sh priorities-mobile' "$workflow"
grep -q 'assets/build-info.json' "$workflow"
grep -Fq 'gh release upload "${GITHUB_REF_NAME}" dist/linux/*.AppImage --clobber' "$workflow"
grep -Fq 'gh release upload "${GITHUB_REF_NAME}" dist/macos/*.zip --clobber' "$workflow"
grep -Fq 'gh release upload "${GITHUB_REF_NAME}" dist/android/*.apk --clobber' "$workflow"
grep -Fq 'gh release upload "${GITHUB_REF_NAME}" dist/ios/*.zip --clobber' "$workflow"
