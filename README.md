# Recents

Recents adds a sidebar pane that lists the notes you opened lately and the notes you pinned, so you can get back to them in one click.

## Install

In Obsidian, open Settings, go to Community plugins, choose Browse, and search for Recents. Install it, then turn it on.

Recents needs Obsidian 1.14.4 or newer. To install it by hand, see [development.md](docs/development.md).

## Use

Open the pane with the history icon in the left ribbon, or run **Recents: Open pane** from the command palette. It opens as a tab in the left sidebar. You can drag it next to the file explorer or anywhere else.

The pane has two sections, **Pinned** and **Recent**. Click a section title to collapse it.

| To do this | Do this |
| --- | --- |
| Open a file | Click it. If the file is already open, you go to that tab. |
| Open in a new tab | Hold Ctrl (Cmd on a Mac) and click, or middle-click. |
| Pin or unpin a file | Click the pin icon on its row, or right-click the file anywhere in Obsidian and choose Pin or Unpin. |
| Reorder pins | Drag a pinned file above or below another one. |
| Remove a file from Recent | Click the x on its row. |
| Insert a link to a file | Drag its row into a note. |
| Preview a file | Hold Ctrl (Cmd on a Mac) and hover over its row. |

The command palette also has **Pin current file**, **Unpin current file**, **Toggle pin for current file** and **Clear recent files**.

## Icons

If you use the [Iconic](https://github.com/gfxholo/iconic) plugin, the icons and colors you gave your files show next to their names here. Files without an icon stay plain, and nothing changes if Iconic is off. After you change an icon, reopen the pane to see it.

## Files outside your vault

Recents lists and pins files from outside your vault, the same as any other file. Hover over a row to see where the file is on your computer. These files open on desktop only, so on a phone a pinned outside file stays in your pins but does not show in the pane. Dragging one into a note and previewing one are not available.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| Show pinned section | On | Shows or hides the Pinned section. |
| Show recent section | On | Shows or hides the Recent section. |
| Section order | Pinned first | Chooses which section is on top. |
| Hide pinned files from recent | Off | A pinned file shows only in the Pinned section. |
| Folder path | Beside the name | Shows the folder each file is in, in a fainter color, to tell apart files that share a name such as README. Choose Off, Beside the name, or Below the name. Below the name, a long path wraps onto more lines. |
| Shorten folder names | Never | Cuts each folder to the fewest letters that still tell it apart from the folders beside it, so `home/improvements/bathroom` can show as `h/imp/bathroom`. Shortened folders look a little fainter. Choose Never, Always, or When clipped, which shortens from the left only as far as needed to fit: on one line beside the name, or on two lines below it. Hidden when Folder path is Off. |
| Folders kept whole | 1 | How many of the innermost folders are never shortened. 1 keeps the folder the file is in. Shown when shortening is on. |
| Show absolute path | Off | Starts the path at the root of your disk instead of your vault, for example `/Users/you/vault/home`. Desktop only. Hidden when Folder path is Off. |
| Path tooltip | When hidden | Shows the full path when you hover over a file. Choose Never, Always, or When hidden, which shows it only if the row does not already show the whole path because the folder path is off, shortened or cut off. |
| Tooltip position | Below | Which side of the file the full path appears on: Below, Above, Left or Right. Hidden when Path tooltip is Never. |
| Tooltip delay | 100 | Milliseconds to wait before the full path shows when you hover over a file. Enter 0 to show it at once. Hidden when Path tooltip is Never. |
| Maximum recent files | 50 | How many files Recent keeps. Older ones drop off the end. Enter a number from 1 to 500. |
| Keep order when opening from the list | Off | A file you open from the pane stays where it is instead of jumping to the top. |
| Switch to an open tab | On | Clicking a file that is already open takes you to that tab. |
| Path patterns | None | Files to keep out of Recent, one pattern per line. For example, `^daily/` skips everything in a folder named daily, and `\.png$` skips PNG images. |

## Syncing

Your pins and settings sync with your vault. The Recent list does not: your phone and your computer each keep their own.

## Credits

- [Recent Files](https://github.com/tgrosinger/recent-files-obsidian) by Tony Grosinger, GPL-3.0, is the model for the recent list and the pane.
- [Pin to Top](https://github.com/valenzine/obsidian-pin-to-top) by valenzine, MIT, is the model for pinning and for reordering pins by dragging.

Recents was written from scratch, and no source code from either plugin was copied. See [NOTICE](NOTICE). For how this plugin differs from Recent Files, see the [development notes](docs/development.md#choices-that-differ-from-recent-files).

## License

[GNU General Public License, version 3](LICENSE).
