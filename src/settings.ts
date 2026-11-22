import { PluginSettingTab, type App, type SettingDefinitionItem } from "obsidian";
import { compilePatterns } from "./model";
import type RecentsPlugin from "./main";
import { MAX_ITEMS_LIMIT, type SectionOrder } from "./types";

function lines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export class RecentsSettingTab extends PluginSettingTab {
  public constructor(
    app: App,
    private readonly plugin: RecentsPlugin,
  ) {
    super(app, plugin);
  }

  public getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        type: "group",
        heading: "Sections",
        items: [
          { name: "Show pinned section", control: { type: "toggle", key: "showPinned" } },
          { name: "Show recent section", control: { type: "toggle", key: "showRecent" } },
          {
            name: "Section order",
            control: {
              type: "dropdown",
              key: "sectionOrder",
              options: { "pinned-first": "Pinned first", "recent-first": "Recent first" },
            },
          },
          {
            name: "Hide pinned files from recent",
            desc: "A pinned file shows only in the pinned section.",
            control: { type: "toggle", key: "hidePinnedFromRecent" },
          },
          {
            name: "Show folder path",
            desc: "Show the folder each file is in after its name, to tell apart files that share a name.",
            control: { type: "toggle", key: "showPath" },
          },
        ],
      },
      {
        type: "group",
        heading: "Recent list",
        items: [
          {
            name: "Maximum recent files",
            desc: "Older files drop off the end of the list.",
            control: {
              type: "number",
              key: "maxItems",
              min: 1,
              max: MAX_ITEMS_LIMIT,
              step: 1,
              validate: (value) =>
                Number.isInteger(value) && value >= 1 && value <= MAX_ITEMS_LIMIT
                  ? undefined
                  : "Enter a whole number from 1 to " + MAX_ITEMS_LIMIT,
            },
          },
          {
            name: "Keep order when opening from the list",
            desc: "A file you open from this pane stays where it is instead of jumping to the top.",
            control: { type: "toggle", key: "keepOrderOnListClick" },
          },
          {
            name: "Switch to an open tab",
            desc: "Clicking a file that is already open goes to that tab. Hold Ctrl or Cmd to open another copy.",
            control: { type: "toggle", key: "focusExistingTab" },
          },
          {
            name: "Clear recent files",
            desc: "Pinned files are not affected.",
            action: () => this.plugin.store.clearRecents(),
          },
        ],
      },
      {
        type: "group",
        heading: "Exclude",
        items: [
          {
            name: "Path patterns",
            desc: "Regular expressions, one per line, tested against the full path. Matching files are not added to the recent list.",
            control: {
              type: "textarea",
              key: "omittedPaths",
              rows: 5,
              placeholder: "^daily/\n\\.png$",
              validate: (value) => {
                const { invalid } = compilePatterns(lines(value));
                return invalid.length > 0 ? "Not a valid pattern: " + invalid.join(", ") : undefined;
              },
            },
          },
        ],
      },
    ];
  }

  public getControlValue(key: string): unknown {
    const { settings } = this.plugin.store;
    switch (key) {
      case "showPinned":
        return settings.showPinned;
      case "showRecent":
        return settings.showRecent;
      case "sectionOrder":
        return settings.sectionOrder;
      case "hidePinnedFromRecent":
        return settings.hidePinnedFromRecent;
      case "showPath":
        return settings.showPath;
      case "maxItems":
        return settings.maxItems;
      case "keepOrderOnListClick":
        return settings.keepOrderOnListClick;
      case "focusExistingTab":
        return settings.focusExistingTab;
      case "omittedPaths":
        return settings.omittedPaths.join("\n");
      default:
        return undefined;
    }
  }

  public setControlValue(key: string, value: unknown): void {
    const { store } = this.plugin;
    if (typeof value === "boolean") {
      switch (key) {
        case "showPinned":
          return store.updateSettings({ showPinned: value });
        case "showRecent":
          return store.updateSettings({ showRecent: value });
        case "hidePinnedFromRecent":
          return store.updateSettings({ hidePinnedFromRecent: value });
        case "showPath":
          return store.updateSettings({ showPath: value });
        case "keepOrderOnListClick":
          return store.updateSettings({ keepOrderOnListClick: value });
        case "focusExistingTab":
          return store.updateSettings({ focusExistingTab: value });
        default:
          return;
      }
    }
    if (typeof value === "number" && key === "maxItems") {
      return store.updateSettings({ maxItems: value });
    }
    if (typeof value !== "string") return;
    switch (key) {
      case "sectionOrder":
        return store.updateSettings({ sectionOrder: value as SectionOrder });
      case "omittedPaths":
        store.updateSettings({ omittedPaths: lines(value) });
        return this.plugin.pruneOmitted();
      default:
        return;
    }
  }
}
