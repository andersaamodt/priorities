# Priorities

Priorities is a to-do app built around one question: what should move up? Add
the things you need to do, promote only the items whose position is wrong, and
stop as soon as the next thing is obvious. The point is to get a messy list into
usable order with the fewest prioritization actions the list actually requires.

Your list is not trapped in an account, a database, or a proprietary sync
service. Priorities stores tasks as ordinary plain text files in a folder you
choose, so you can inspect them, back them up, edit them, sync them, or script
them with normal tools.

## What It Does

- Store tasks as plain text files.
- Keep a prioritized list visible without ranking everything from
  scratch.
- Promote only the tasks that need to move.
- Check tasks off when they are complete.
- Rename or delete tasks without leaving the app.
- Turn a task into a project folder when it needs sub-tasks.
- Drill into folders and back out again.
- Copy the visible list as a Markdown checklist.
- Choose themes, fonts, and text scale.

## Command Line

Because priorities are plain files, the app is not the only way in. You can add
priorities quickly from a terminal, script new priorities from another workflow,
or use Wizardry's interactive menus to manage the same lists without opening the
native app.

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

Priorities is built on the Forge native app pipeline. The app UI lives in
`index.html` and `style.css`; themes live in `themes/`; the local file backend
is `scripts/priorities-backend.sh`.

Useful local checks:

```sh
sh -n scripts/priorities-backend.sh
.tests/test-support-development.sh
.tests/test-build-artifacts-workflow.sh
```

The CI workflow is in `.github/workflows/build-artifacts.yml`. It checks out the
Forge pipeline repository, validates the app contract, and builds native
artifacts.

This project is licensed under GNU AGPL-3.0-or-later.
Additional terms apply; see WIZARDRY_ADDENDUM.md.
