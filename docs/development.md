# Development

## Install from source

Recents is not in the community directory yet. To try it, build it and copy the output into a vault:

```sh
pnpm install
pnpm build
mkdir -p <vault>/.obsidian/plugins/recents
cp main.js manifest.json styles.css <vault>/.obsidian/plugins/recents/
```

Then turn it on under Settings > Community plugins. Releases attach the same three files. Requires Obsidian 1.14.4 or newer.

While developing, symlink the three files instead of copying them. Each build then shows up after a plugin reload.

## Where the data lives

Pins and options are in the plugin's `data.json`, so they sync with the vault. The recent list is stored in the app's local storage for the vault and stays on each device. A phone and a desktop keep their own recent lists but share pins.

## Choices that differ from Recent Files

Recents settles several open Recent Files issues in its design:

- Recent Files keeps one recent list in the vault, so it syncs between devices, and [#34](https://github.com/tgrosinger/recent-files-obsidian/issues/34) asks for it not to. Here each device keeps its own list.
- Files outside the vault can be recorded and then fail to open ([#138](https://github.com/tgrosinger/recent-files-obsidian/issues/138)). Here they open, and they stay in the list while they can't be found, for example when a drive is unplugged.
- Clicking a file that is already open does not switch to its tab ([#121](https://github.com/tgrosinger/recent-files-obsidian/issues/121)). Here it does, unless you turn that off.
- Opening a file from the list always moves it to the top ([#23](https://github.com/tgrosinger/recent-files-obsidian/issues/23)). Here that is an option.
- Pinning ([#139](https://github.com/tgrosinger/recent-files-obsidian/issues/139), [#126](https://github.com/tgrosinger/recent-files-obsidian/issues/126)) is built in.

Other differences: a folder rename updates every pin and recent entry under it. The list stores paths only, so a renamed note never shows a stale title.

## Iconic icons

Iconic documents no API for other plugins. `src/iconic.ts` reads the loaded plugin from `app.plugins.plugins.iconic` and calls two of its internal members, `getFileItem(path)` and `ruleManager.checkRuling("file", id)`, the same pair Iconic uses to draw its own file lists. Every member is checked before use and the lookup runs inside a try/catch, so if an Iconic update changes them, rows lose their icons and nothing else breaks. It was written against Iconic 1.1.11.

Only icons a user assigned are shown, not Iconic's default file icons. Files outside the vault never get one. The pane reads icons each time it redraws, so a change made in Iconic appears on the next redraw.

## Files outside the vault

Obsidian addresses a file outside the vault as `file:` followed by its absolute path, and only the desktop app can open one. Recents stores that path like any other. Dragging a row into a note and the hover preview are skipped for these files.

## Development commands

```sh
pnpm install
pnpm dev      # rebuild main.js on every change
pnpm lint
pnpm test
pnpm build
```

The logic that does not need Obsidian (`src/model.ts`, `src/store.ts`) has unit tests. The pane, settings and plugin entry run only inside Obsidian.

## Releasing

Run `make release` from a clean `main` branch. It picks the next date-based version (`YYYY.MMDD.N`, starting at 1 each day) and commits it to `manifest.json`, `versions.json` and `package.json`. Then it tags that commit without a `v` prefix and pushes `main` and the tag together. Finally it builds `main.js` from the tag in a temporary worktree and publishes a GitHub release with `main.js`, `manifest.json` and `styles.css` attached. It needs Git, Python 3, pnpm and a signed-in [GitHub CLI](https://cli.github.com/).

```sh
make release-dry-run
make release
make release ARGS="--version 2026.1122.1"
```

### Alpha and beta releases

```sh
make release-dry-run PRE=alpha
make release-alpha
make release-beta
```

A pre-release targets the next stable version and counts up from 1: after `2026.1122.1`, the first alpha is `2026.1122.2-alpha.1`, the next is `-alpha.2`, and the first beta is `-beta.1`. An alpha cannot follow a beta of the same version. The version bump is committed only on the tag, so `main` keeps the last stable version in `manifest.json`, which is the file the community plugin directory reads. The GitHub release is marked as a pre-release. Testers install it with [BRAT](https://github.com/TfTHacker/obsidian42-brat) by adding `khaister/obsidian-recents`.

`--dry-run` uses local tags and does not change files or publish anything. Use `ARGS="--no-release"` to push without publishing, or `ARGS="--release-only 2026.1122.1"` to publish an existing tag using its original files. Run `./scripts/release.sh --help` for all options.
