import { Notice, Plugin, TFile, debounce, type PaneType } from "obsidian";
import { isExternalPath } from "./model";
import { openFile } from "./open";
import { PANE_MENU_SOURCE } from "./sections";
import { RecentsSettingTab } from "./settings";
import { Store } from "./store";
import { RecentsView, VIEW_TYPE } from "./view";

/** Recents stay on this device. Obsidian scopes this key to the vault. */
const RECENTS_STORAGE_KEY = "recents:list";

export default class RecentsPlugin extends Plugin {
  public store!: Store;

  /** Path opened from the list that should not move to the top. */
  private skipRecord: string | null = null;
  private skipTimer: number | null = null;

  private readonly saveDataSoon = debounce(
    () => {
      void this.saveData(this.store.snapshot());
    },
    250,
    true,
  );

  private readonly saveRecentsSoon = debounce(
    () => {
      this.app.saveLocalStorage(RECENTS_STORAGE_KEY, this.store.recents);
    },
    250,
    true,
  );

  public async onload(): Promise<void> {
    const data: unknown = await this.loadData();
    const recents: unknown = this.app.loadLocalStorage(RECENTS_STORAGE_KEY);
    this.store = new Store(
      {
        saveData: () => this.saveDataSoon(),
        saveRecents: () => this.saveRecentsSoon(),
      },
      { data, recents },
    );

    this.registerView(VIEW_TYPE, (leaf) => new RecentsView(leaf, this.store, this.openFromList));
    this.registerHoverLinkSource(VIEW_TYPE, { display: "Recents", defaultMod: true });
    this.addSettingTab(new RecentsSettingTab(this.app, this));
    this.addRibbonIcon("history", "Open recents", () => {
      void this.openPane();
    });
    this.registerCommands();
    this.registerFileEvents();

    // A quit inside the debounce window would lose the last change.
    this.registerDomEvent(window, "beforeunload", () => this.flush());

    this.app.workspace.onLayoutReady(() => {
      this.pruneOmitted();
      this.pruneMissing();
      // Rows for files the vault had not indexed yet were skipped. Draw them now.
      this.store.refresh();
    });
  }

  public onunload(): void {
    this.flush();
    if (this.skipTimer !== null) window.clearTimeout(this.skipTimer);
  }

  public onUserEnable(): void {
    void this.openPane();
  }

  public async onExternalSettingsChange(): Promise<void> {
    this.store.reloadData(await this.loadData());
  }

  /** Drop recents that the omit rules would not allow now. */
  public pruneOmitted(): void {
    this.store.pruneRecents((path) => {
      const file = this.app.vault.getFileByPath(path);
      return file === null || this.shouldTrack(file);
    });
  }

  /**
   * Forget recents whose vault file is gone. An external file is kept even when it
   * cannot be found right now, because its drive or folder may just be unavailable.
   */
  private pruneMissing(): void {
    this.store.pruneRecents((path) => isExternalPath(path) || this.app.vault.getFileByPath(path) !== null);
  }

  private flush(): void {
    this.saveDataSoon.run();
    this.saveRecentsSoon.run();
  }

  private async openPane(): Promise<void> {
    await this.app.workspace.ensureSideLeaf(VIEW_TYPE, "left", { reveal: true });
  }

  private readonly openFromList = (file: TFile, mode: PaneType | boolean): void => {
    if (this.store.settings.keepOrderOnListClick && this.store.recents.includes(file.path)) {
      this.skipRecord = file.path;
      if (this.skipTimer !== null) window.clearTimeout(this.skipTimer);
      this.skipTimer = window.setTimeout(() => {
        this.skipRecord = null;
      }, 1500);
    }
    openFile(this.app, file, mode, this.store.settings.focusExistingTab).catch(() => {
      new Notice("Could not open " + file.name);
    });
  };

  /** A file, in the vault or outside it. Folders and anything else are ignored. */
  private asFile(file: unknown): TFile | null {
    return file instanceof TFile ? file : null;
  }

  private shouldTrack(file: TFile): boolean {
    return !this.store.pathOmitted(file.path);
  }

  private registerFileEvents(): void {
    this.registerEvent(
      this.app.workspace.on("file-open", (opened) => {
        const file = this.asFile(opened);
        if (!file) return;
        if (this.skipRecord === file.path) {
          this.skipRecord = null;
          return;
        }
        if (this.shouldTrack(file)) this.store.recordOpen(file.path);
      }),
    );

    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => this.store.rename(oldPath, file.path)),
    );
    this.registerEvent(this.app.vault.on("delete", (file) => this.store.remove(file.path)));

    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file, source) => {
        // The pane builds its own menu with a pin item already in it.
        if (source === PANE_MENU_SOURCE) return;
        const target = this.asFile(file);
        if (!target) return;
        const pinned = this.store.isPinned(target.path);
        menu.addItem((item) =>
          item
            .setTitle(pinned ? "Unpin from recents" : "Pin to recents")
            .setIcon(pinned ? "pin-off" : "pin")
            .setSection("action")
            .onClick(() => this.store.togglePin(target.path)),
        );
      }),
    );
  }

  private registerCommands(): void {
    this.addCommand({
      id: "open-pane",
      name: "Open pane",
      callback: () => {
        void this.openPane();
      },
    });

    const activeFileCommand = (id: string, name: string, run: (path: string) => void, when: (path: string) => boolean): void => {
      this.addCommand({
        id,
        name,
        checkCallback: (checking) => {
          const file = this.app.workspace.getActiveFile();
          const target = this.asFile(file);
          if (!target || !when(target.path)) return false;
          if (!checking) run(target.path);
          return true;
        },
      });
    };
    activeFileCommand("pin-current", "Pin current file", (p) => this.store.pin(p), (p) => !this.store.isPinned(p));
    activeFileCommand("unpin-current", "Unpin current file", (p) => this.store.unpin(p), (p) => this.store.isPinned(p));
    activeFileCommand("toggle-pin-current", "Toggle pin for current file", (p) => this.store.togglePin(p), () => true);

    this.addCommand({
      id: "clear-recents",
      name: "Clear recent files",
      callback: () => this.store.clearRecents(),
    });
  }
}
