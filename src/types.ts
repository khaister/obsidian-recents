export type SectionId = "pinned" | "recent";

export type SectionOrder = "pinned-first" | "recent-first";

/** Which side of a row its tooltip appears on. */
export type TooltipPosition = "top" | "bottom" | "left" | "right";

/** When a row shows its full path on hover. */
export type TooltipMode = "never" | "hidden" | "always";

/** When folder names are cut to their first letter. */
export type ShortenMode = "never" | "clipped" | "always";

/** Where a file's folder path goes in its row. */
export type PathLocation = "off" | "beside" | "below";

export interface RecentsSettings {
  /** Most recent files to keep in the list. */
  maxItems: number;
  showPinned: boolean;
  showRecent: boolean;
  sectionOrder: SectionOrder;
  /** Leave a pinned file out of the recent section. */
  hidePinnedFromRecent: boolean;
  /** Where to show the folder a file is in. */
  pathLocation: PathLocation;
  /** Cut each folder name to its first letter, so h/i/b stands for home/improvements/bathroom. */
  shortenFolders: ShortenMode;
  /** How many of the innermost folders are never shortened. */
  keepFolders: number;
  /** Show the path from the root of the disk instead of from the vault root. Desktop only. */
  absolutePath: boolean;
  tooltipMode: TooltipMode;
  tooltipPosition: TooltipPosition;
  /** Milliseconds to wait before a row's path tooltip appears. */
  tooltipDelay: number;
  /** Mark the file open in the editor with the theme's active-row color. */
  highlightActive: boolean;
  /** Switch to the tab that already shows the file instead of opening a copy. */
  focusExistingTab: boolean;
  /** Opening a file from the list does not move it to the top. */
  keepOrderOnListClick: boolean;
  /** One regular expression per entry, tested against the vault path. */
  omittedPaths: string[];
  collapsed: Record<SectionId, boolean>;
}

/** Everything saved to data.json. Pins sync with the vault, recents do not. */
export interface PersistedData {
  settings: RecentsSettings;
  pins: string[];
}

export const MAX_ITEMS_LIMIT = 500;

export const MAX_TOOLTIP_DELAY = 2000;

export const MAX_KEEP_FOLDERS = 10;

export const DEFAULT_SETTINGS: RecentsSettings = {
  maxItems: 50,
  showPinned: true,
  showRecent: true,
  sectionOrder: "pinned-first",
  hidePinnedFromRecent: false,
  pathLocation: "beside",
  shortenFolders: "never",
  keepFolders: 1,
  absolutePath: false,
  tooltipMode: "hidden",
  tooltipPosition: "bottom",
  tooltipDelay: 100,
  highlightActive: true,
  focusExistingTab: true,
  keepOrderOnListClick: false,
  omittedPaths: [],
  collapsed: { pinned: false, recent: false },
};
