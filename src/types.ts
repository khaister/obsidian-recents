export type SectionId = "pinned" | "recent";

export type SectionOrder = "pinned-first" | "recent-first";

export interface RecentsSettings {
  /** Most recent files to keep in the list. */
  maxItems: number;
  showPinned: boolean;
  showRecent: boolean;
  sectionOrder: SectionOrder;
  /** Leave a pinned file out of the recent section. */
  hidePinnedFromRecent: boolean;
  /** Show the folder a file is in after its name. */
  showPath: boolean;
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

export const DEFAULT_SETTINGS: RecentsSettings = {
  maxItems: 50,
  showPinned: true,
  showRecent: true,
  sectionOrder: "pinned-first",
  hidePinnedFromRecent: false,
  showPath: true,
  focusExistingTab: true,
  keepOrderOnListClick: false,
  omittedPaths: [],
  collapsed: { pinned: false, recent: false },
};
