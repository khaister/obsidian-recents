import { ItemView, debounce, type HoverParent, type Menu, type PaneType, type TFile, type WorkspaceLeaf } from "obsidian";
import { renderSections } from "./sections";
import type { Store } from "./store";

export const VIEW_TYPE = "recents-view";

export class RecentsView extends ItemView {
  private readonly hover: HoverParent = { hoverPopover: null };
  private readonly requestRedraw = debounce(() => this.redraw(), 30, true);
  /** Stops the width watcher from the last draw. */
  private stopWatching: () => void = () => undefined;

  public constructor(
    leaf: WorkspaceLeaf,
    private readonly store: Store,
    private readonly openFromList: (file: TFile, mode: PaneType | boolean) => void,
  ) {
    super(leaf);
  }

  public getViewType(): string {
    return VIEW_TYPE;
  }

  public getDisplayText(): string {
    return "Recents";
  }

  public getIcon(): string {
    return "history";
  }

  public onOpen(): Promise<void> {
    this.contentEl.addClass("recents-view");
    this.register(this.store.onChange(() => this.requestRedraw()));
    // The active file highlight follows the editor, not the store.
    this.registerEvent(this.app.workspace.on("file-open", () => this.requestRedraw()));
    this.redraw();
    return Promise.resolve();
  }

  public onClose(): Promise<void> {
    this.stopWatching();
    return Promise.resolve();
  }

  public onPaneMenu(menu: Menu, source: string): void {
    super.onPaneMenu(menu, source);
    menu.addItem((item) =>
      item
        .setTitle("Clear recent files")
        .setIcon("eraser")
        .setSection("action")
        .onClick(() => this.store.clearRecents()),
    );
  }

  private redraw(): void {
    // Rebuilding the list resets the scroll position unless it is put back.
    const scrollTop = this.contentEl.scrollTop;
    this.stopWatching();
    this.stopWatching = renderSections(this.contentEl, {
      app: this.app,
      store: this.store,
      hoverSource: VIEW_TYPE,
      hoverParent: this.hover,
      openFromList: this.openFromList,
    });
    this.contentEl.scrollTop = scrollTop;
  }
}
