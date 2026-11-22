import { PluginSettingTab, type App, type Setting, type SettingDefinitionItem } from "obsidian";
import { compilePatterns } from "./model";
import type RecentsPlugin from "./main";
import { MAX_ITEMS_LIMIT, MAX_TOOLTIP_DELAY, type PathLocation, type SectionOrder } from "./types";

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
            name: "Folder path",
            desc: "Show the folder each file is in, to tell apart files that share a name. Below the name, a long path wraps onto more lines.",
            control: {
              type: "dropdown",
              key: "pathLocation",
              options: { off: "Off", beside: "Beside the name", below: "Below the name" },
            },
          },
          {
            name: "Shorten folder names",
            desc: "Cut each folder to its first letter, so home/improvements/bathroom shows as h/i/b.",
            control: { type: "toggle", key: "shortenPath" },
          },
          {
            name: "Show absolute path",
            desc: "Start the path at the root of your disk instead of the vault. Desktop only.",
            control: { type: "toggle", key: "absolutePath" },
          },
          {
            name: "Tooltip delay",
            desc: "Milliseconds to wait before the full path shows when you hover over a file. Enter 0 to show it at once.",
            control: {
              type: "number",
              key: "tooltipDelay",
              min: 0,
              max: MAX_TOOLTIP_DELAY,
              step: 50,
              validate: (value) =>
                Number.isInteger(value) && value >= 0 && value <= MAX_TOOLTIP_DELAY
                  ? undefined
                  : "Enter a whole number from 0 to " + MAX_TOOLTIP_DELAY,
            },
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
            render: (setting) => this.renderPathPatterns(setting),
          },
        ],
      },
    ];
  }

  /**
   * A text box under the description, as wide as the page, in a monospace font.
   * The built-in textarea control sits beside the description, so this draws its own.
   */
  private renderPathPatterns(setting: Setting): void {
    const { store } = this.plugin;
    setting.settingEl.addClass("recents-wide-setting");
    setting.addTextArea((area) => {
      area.inputEl.rows = 5;
      area.inputEl.addClass("recents-pattern-input");
      area.setPlaceholder("^daily/\n\\.png$").setValue(store.settings.omittedPaths.join("\n"));
      const warning = setting.controlEl.createDiv({ cls: "recents-setting-warning" });
      area.onChange((value) => {
        const { invalid } = compilePatterns(lines(value));
        warning.setText(invalid.length > 0 ? "Not a valid pattern: " + invalid.join(", ") : "");
        // An invalid pattern is shown but not saved, so the last good list stays in effect.
        if (invalid.length > 0) return;
        store.updateSettings({ omittedPaths: lines(value) });
        this.plugin.pruneOmitted();
      });
    });
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
      case "pathLocation":
        return settings.pathLocation;
      case "shortenPath":
        return settings.shortenPath;
      case "absolutePath":
        return settings.absolutePath;
      case "maxItems":
        return settings.maxItems;
      case "tooltipDelay":
        return settings.tooltipDelay;
      case "keepOrderOnListClick":
        return settings.keepOrderOnListClick;
      case "focusExistingTab":
        return settings.focusExistingTab;
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
        case "shortenPath":
          return store.updateSettings({ shortenPath: value });
        case "absolutePath":
          return store.updateSettings({ absolutePath: value });
        case "keepOrderOnListClick":
          return store.updateSettings({ keepOrderOnListClick: value });
        case "focusExistingTab":
          return store.updateSettings({ focusExistingTab: value });
        default:
          return;
      }
    }
    if (typeof value === "number") {
      if (key === "maxItems") return store.updateSettings({ maxItems: value });
      if (key === "tooltipDelay") return store.updateSettings({ tooltipDelay: value });
    }
    if (typeof value !== "string") return;
    switch (key) {
      case "sectionOrder":
        return store.updateSettings({ sectionOrder: value as SectionOrder });
      case "pathLocation":
        return store.updateSettings({ pathLocation: value as PathLocation });
      default:
        return;
    }
  }
}
