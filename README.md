# Priorities

Priorities is a small, folder-based app for keeping the next thing visible.
Point it at a folder, add tasks, move the important ones upward, check off what
is done, and drill into projects when a task grows into a list of its own.

It is built to work with ordinary files instead of a hosted account. Your
priorities can live in any folder you control, including a folder synced across
devices.

## What It Does

- Shows a prioritized task list from a folder.
- Adds new tasks as files.
- Promotes tasks when they become more important.
- Checks tasks off when they are complete.
- Renames or deletes tasks without leaving the app.
- Turns a task into a project folder when it needs sub-tasks.
- Lets you drill into folders and back out again.
- Copies the visible list as a Markdown checklist.
- Offers themes, font choices, and text scale controls.

## Sync

Priorities does not require a cloud service. For phone, tablet, and desktop
sync, point Priorities at a folder synced by
[Syncthing](https://syncthing.net/). Syncthing keeps the folder moving between
your devices, while Priorities reads and writes the files in that folder.

The app is designed to be friendly to synced folders. On platforms where regular
file metadata is not a good fit, Priorities can store its task metadata in small
sidecar files next to your tasks.

## Support Development

Priorities includes an optional Support Development panel. You can send a
one-time Lightning zap, copy the zap address, or enable small usage-based zaps
for actions you choose:

- When you create a task.
- When you complete a task.
- When you reprioritize a task.
- When you delete an incomplete task.

Usage-based zaps are off by default. They require your own Nostr Wallet Connect
URI, and you control the per-action amount and daily limit.

## Builds

GitHub Actions builds installable artifacts on pushes to `main`, pull requests,
and manual workflow runs:

- Linux AppImage
- macOS app bundle zip
- Android debug APK
- iOS Simulator app zip

Open the latest successful `Build Artifacts` workflow run on GitHub and download
the artifact for your platform.

## Developer Notes

Priorities is a Wizardry app built on the Forge native app pipeline. The app UI
lives in `index.html` and `style.css`; themes live in `themes/`; the local file
backend is `scripts/priorities-backend.sh`.

Useful local checks:

```sh
sh -n scripts/priorities-backend.sh
.tests/test-support-development.sh
.tests/test-build-artifacts-workflow.sh
```

The CI workflow is in `.github/workflows/build-artifacts.yml`. It checks out
`andersaamodt/wizardry-apps`, validates the app contract, and uses the Forge
pipeline to build native artifacts.

This project is licensed under GNU AGPL-3.0-or-later.
Additional terms apply; see WIZARDRY_ADDENDUM.md.
