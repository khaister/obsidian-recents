# Recents

Recents adds a sidebar pane with the files you opened lately and the files you pinned, one click away.

## Install

In Obsidian, open Settings, go to Community plugins, choose Browse, and search for Recents. Install it, then turn it on.

Recents needs Obsidian 1.14.4 or newer. To install it by hand, see [development.md](docs/development.md).

## Use

Open the pane with the history icon in the left ribbon, or run **Recents: Open pane** from the command palette. It opens as a tab in the left sidebar, and you can drag it next to the file explorer or anywhere else.

The pane has two sections, **Pinned** and **Recent**. Click a section title to collapse it.

| To do this | Do this |
| --- | --- |
| Open a file | Click it. If the file is already open, you go to that tab. |
| Open in a new tab | Hold Ctrl (Cmd on a Mac) and click, or middle-click. |
| Pin or unpin a file | Click the pin icon on its row, or right-click the file anywhere in Obsidian and choose **Pin to recents** or **Unpin from recents**. |
| Reorder pins | Drag a pinned file above or below another one. |
| Remove a file from Recent | Click the x on its row. |
| Insert a link to a file | Drag its row into a note. |
| Preview a file | Hold Ctrl (Cmd on a Mac) and hover over its row. |

The command palette also has **Pin current file**, **Unpin current file**, **Toggle pin for current file** and **Clear recent files**.

## Icons

If you use the [Iconic](https://github.com/gfxholo/iconic) plugin, the icons and colors you gave your files show next to their names. Files without an icon stay plain, and if Iconic is off, the pane looks as it would without it. After you change an icon, reopen the pane to see it.

## Files outside your vault

Recents lists and pins files from outside your vault like any other file, and hovering over one shows where it is on your computer. Obsidian opens these files on desktop only. On a phone, a pinned outside file stays in your pins but is not shown. You can't drag one into a note or preview it.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| Show pinned section | On | Shows or hides the Pinned section. |
| Show recent section | On | Shows or hides the Recent section. |
| Section order | Pinned first | Chooses which section is on top. |
| Show pinned files in recent | On | A pinned file also shows in the Recent section. Turn it off to show it only in the Pinned section. |
| Folder path | Beside the name | Shows the folder each file is in, in a fainter color, to tell apart files that share a name such as README. Choose Off, Beside the name, or Below the name. Below the name, a long path wraps onto more lines. |
| Shorten folder names | Never | Cuts each folder to the fewest letters that still tell it apart from the folders beside it, so `home/improvements/bathroom` can show as `h/im/bathroom`. Shortened folders look a little fainter. Choose Never, Always, or When clipped, which shortens only as much as needed, starting from the left: to fit one line beside the name, or two lines below it. Hidden when Folder path is Off. |
| Folders kept whole | 1 | How many of the innermost folders are never shortened. 1 keeps the folder the file is in. Shown when shortening is on. |
| Show absolute path | Off | Starts the path at the root of your disk instead of your vault, for example `/Users/you/vault/home`. Desktop only. Hidden when Folder path is Off. |
| Path tooltip | When hidden | Shows the full path when you hover over a file. Choose Never, Always, or When hidden, which shows it only if the row does not already show the whole path because the folder path is off, shortened or cut off. |
| Tooltip position | Below | Which side of the file the full path appears on: Below, Above, Left or Right. Hidden when Path tooltip is Never. |
| Tooltip delay | 100 | Milliseconds to wait before the full path shows when you hover over a file. Enter 0 to show it at once. Hidden when Path tooltip is Never. |
| Highlight the open file | On | Marks the file you are viewing, the way the file explorer does. Turn it off to keep every row plain. |
| Maximum recent files | 50 | How many files Recent keeps. Older ones drop off the end. Enter a number from 1 to 500. |
| Keep order when opening from the list | Off | A file you open from the pane stays where it is instead of jumping to the top. |
| Switch to an open tab | On | Clicking a file that is already open takes you to that tab. |
| Path patterns | None | Files to keep out of Recent, one pattern per line. For example, `^daily/` skips everything in a folder named daily, and `\.png$` skips PNG images. |

## Syncing

Your pins and settings sync with your vault. The Recent list does not: your phone and your computer each keep their own.

## Compared with Recent Files and Pin to Top

Recents puts a recent list and pins in one pane, which otherwise takes two plugins. See feature comparison below.

| | Recents | [Recent Files](https://github.com/tgrosinger/recent-files-obsidian) 1.7.10 | [Pin to Top](https://github.com/valenzine/obsidian-pin-to-top) 1.0.2 |
| --- | --- | --- | --- |
| Where it shows | Its own sidebar pane | Its own sidebar pane | Top of the file explorer |
| List of recently opened files | Yes | Yes | No |
| Pin files | Yes | No | Yes |
| Pin folders | No | No | Yes |
| Reorder pins by dragging | Yes | n/a | No |
| Collapse or hide each section | Yes | n/a | No |
| Recent list across devices | Each device keeps its own | One list, synced with the vault | n/a |
| Leave out files by path pattern | Yes | Yes | n/a |
| Leave out files by tag or bookmark | No | Yes | n/a |
| Update the list when a file is edited instead of opened | No | Yes | n/a |
| Files outside the vault | Listed and opened, on desktop | Can be listed but fail to open ([#138](https://github.com/tgrosinger/recent-files-obsidian/issues/138)) | No |
| Clicking an open file goes to its tab | Yes, optional | No ([#121](https://github.com/tgrosinger/recent-files-obsidian/issues/121)) | n/a |
| Keep list order when opening from it | Optional | No ([#23](https://github.com/tgrosinger/recent-files-obsidian/issues/23)) | n/a |
| Folder path next to each file name | Yes, beside or below, can be shortened | No | n/a |
| Icons from the Iconic plugin | Yes | No | Not checked |
| Titles from the Front Matter Title plugin | No | Yes | Not checked |
| Drag a file into a note to link it | Yes | Yes | n/a |
| Hover preview | Yes | Yes | n/a |
| Pin, unpin and toggle commands | Yes | n/a | Yes |
| Minimum Obsidian version | 1.14.4 | 0.16.3 | 1.0.0 |

## Credits

- [Recent Files](https://github.com/tgrosinger/recent-files-obsidian) by Tony Grosinger, GPL-3.0, is the model for the recent list and the pane.
- [Pin to Top](https://github.com/valenzine/obsidian-pin-to-top) by valenzine, MIT, is the model for pinning files and for the pin commands.

Recents was written from scratch, with no source code copied from either plugin. See [NOTICE](NOTICE). The [development notes](docs/development.md#choices-that-differ-from-recent-files) explain where Recents departs from Recent Files and why.

## License

[GNU General Public License, version 3](LICENSE).
