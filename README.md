# Recents for Obsidian

An Obsidian plugin that keeps your recently opened pinned files in a sidebar pane.

## Install

Recents is not in the community directory yet. To try it, build it and copy the output into a vault:

```sh
pnpm install
pnpm build
mkdir -p <vault>/.obsidian/plugins/recents
cp main.js manifest.json styles.css <vault>/.obsidian/plugins/recents/
```

Then turn it on under Settings > Community plugins. Releases will attach the same three files. Requires Obsidian 1.14.4 or newer.

## Use

Open the pane with the history icon in the ribbon or the **Recents: Open pane** command. It opens as a tab in the left sidebar.

The pane has two sections, **Pinned** and **Recent**. Click a section title to collapse it.

| Action | How |
| --- | --- |
| Open a file | Click it. If the file is already open, you go to that tab. |
| Open in a new tab | Ctrl or Cmd click, or middle click. |
| Pin or unpin | The pin icon on a row, the row's right-click menu, a file's right-click menu anywhere in Obsidian, or the pin commands. |
| Reorder pins | Drag a pinned row above or below another one. |
| Remove from recent | The x icon on a row, or its right-click menu. |
| Insert a link | Drag a row into a note. The link uses your link format from Settings > Files and links. |
| Preview | Hold Ctrl or Cmd and hover a row. Change the modifier requirement under Settings > Core plugins > Page preview. |

Commands: Open pane, Pin current file, Unpin current file, Toggle pin for current file, Clear recent files.

## Files outside the vault

Obsidian 1.14.4 added support for opening files outside the vault. Recents lists and pins them like any other file, and hovering a row shows the path on disk. Obsidian opens these files on desktop only, so on a phone a pinned outside file stays in your pins but does not show in the pane. Two things do not work for outside files: dragging a row into a note to insert a link, and the hover preview.

## Options

| Option | Default | What it does |
| --- | --- | --- |
| Show pinned section | On | Shows or hides the pinned section. |
| Show recent section | On | Shows or hides the recent section. |
| Section order | Pinned first | Puts either section on top. |
| Hide pinned files from recent | Off | A pinned file appears only in the pinned section. |
| Maximum recent files | 50 | Older files drop off the end. Type any whole number from 1 to 500. |
| Keep order when opening from the list | Off | A file you open from the pane stays where it is. |
| Switch to an open tab | On | Clicking a file that is already open goes to its tab. |
| Path patterns | None | Regular expressions, one per line. Matching files never enter the recent list. |

## Where the data lives

Pins and options are in the plugin's `data.json`, so they sync with the vault. The recent list is stored in the app's local storage for the vault and stays on each device. Your phone and your desktop keep their own recent lists but share pins.

## Choices that differ from Recent Files

Recent Files has open issues for a few things this plugin handles by design:

- Recent lists do not sync between devices ([#34](https://github.com/tgrosinger/recent-files-obsidian/issues/34)). Here they never do.
- Files outside the vault can be recorded and then fail to open ([#138](https://github.com/tgrosinger/recent-files-obsidian/issues/138)). Here they open, and they are not dropped from the list when they cannot be found.
- Clicking a file that is already open does not switch to its tab ([#121](https://github.com/tgrosinger/recent-files-obsidian/issues/121)). Here it does, unless you turn that off.
- Opening a file from the list always moves it to the top ([#23](https://github.com/tgrosinger/recent-files-obsidian/issues/23)). Here that is an option.
- Pinning ([#139](https://github.com/tgrosinger/recent-files-obsidian/issues/139), [#126](https://github.com/tgrosinger/recent-files-obsidian/issues/126)) is built in.

Other differences: a folder rename updates every pin and recent entry under it. The list stores paths only, so a renamed note never shows a stale title.

## Releasing

Run `make release` from a clean `main` branch. The helper selects the next date-based version (`YYYY.MMDD.N`, starting at 1 each day), updates and commits `manifest.json` and `versions.json`, creates an annotated tag without a `v` prefix, pushes `main` and the tag together, builds `main.js` from the tag in a temporary worktree, and publishes a GitHub release with `main.js`, `manifest.json` and `styles.css` attached. Requires Git, Python 3, pnpm and an authenticated [GitHub CLI](https://cli.github.com/).

```sh
make release-dry-run
make release
make release ARGS="--version 2026.1122.1"
```

`--dry-run` uses local tags and does not change files or publish anything. Use `ARGS="--no-release"` to push without publishing, or `ARGS="--release-only 2026.1122.1"` to publish an existing tag using its original files. Run `./scripts/release.sh --help` for all options.

## Development

```sh
pnpm install
pnpm dev      # rebuild main.js on every change
pnpm lint
pnpm test
pnpm build
```

The logic that does not need Obsidian (`src/model.ts`, `src/store.ts`) has unit tests. The pane, settings and plugin entry run only inside Obsidian.

## Credits

- [Recent Files](https://github.com/tgrosinger/recent-files-obsidian) by Tony Grosinger, GPL-3.0. It is the reference for the recent list and the pane's behavior.
- [Pin to Top](https://github.com/valenzine/obsidian-pin-to-top) by valenzine, MIT. It is the reference for pinning and for reordering pins by dragging.

Recents was written from scratch. No source code from either plugin was copied. See [NOTICE](NOTICE).

## License

[GNU General Public License, version 3](LICENSE).
