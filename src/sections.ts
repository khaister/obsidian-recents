import { FileSystemAdapter, Keymap, Menu, setIcon, setTooltip, type App, type HoverParent, type PaneType, type TFile } from "obsidian";
import { getFileIcon, knownIconIds, renderIcon } from "./iconic";
import { folderLabel, fullPathLabel, isExternalPath, type PathStyle } from "./model";
import type { Store } from "./store";
import type { SectionId } from "./types";

/** Menu source for our own context menu, so the pin item is not added twice. */
export const PANE_MENU_SOURCE = "recents-pane";

export interface SectionsHost {
  app: App;
  store: Store;
  /** Id passed to registerHoverLinkSource. */
  hoverSource: string;
  hoverParent: HoverParent;
  openFromList(file: TFile, mode: PaneType | boolean): void;
}

/** Path of the pinned row being dragged, if any. */
let draggingPin: string | null = null;

/** Draw the enabled sections into `container`. Used by the pane today and any other host later. */
export function renderSections(container: HTMLElement, host: SectionsHost): void {
  container.empty();
  const { settings, pins, recents } = host.store;

  const pinned = pins;
  const recent = settings.hidePinnedFromRecent ? recents.filter((p) => !pins.includes(p)) : recents;

  const sections: { id: SectionId; title: string; paths: string[]; visible: boolean }[] = [
    { id: "pinned", title: "Pinned", paths: pinned, visible: settings.showPinned },
    { id: "recent", title: "Recent", paths: recent, visible: settings.showRecent },
  ];
  if (settings.sectionOrder === "recent-first") sections.reverse();

  const visible = sections.filter((s) => s.visible);
  if (visible.length === 0) {
    container.createDiv({ cls: "recents-empty", text: "Both sections are hidden. Turn one on in the plugin options." });
    return;
  }
  for (const section of visible) renderSection(container, host, section.id, section.title, section.paths);
}

function renderSection(
  container: HTMLElement,
  host: SectionsHost,
  id: SectionId,
  title: string,
  paths: string[],
): void {
  const { app, store } = host;
  const collapsed = store.settings.collapsed[id];
  const files = paths
    .map((p) => app.vault.getFileByPath(p))
    .filter((f): f is TFile => f !== null);

  const sectionEl = container.createDiv({ cls: "recents-section tree-item" });
  sectionEl.toggleClass("is-collapsed", collapsed);

  const header = sectionEl.createDiv({ cls: "recents-section-header tree-item-self is-clickable" });
  header.setAttr("role", "button");
  header.setAttr("tabindex", "0");
  header.setAttr("aria-expanded", String(!collapsed));
  const icon = header.createDiv({ cls: "tree-item-icon collapse-icon" });
  setIcon(icon, "right-triangle");
  header.createDiv({ cls: "tree-item-inner recents-section-title", text: title });
  header.createDiv({ cls: "recents-section-count", text: String(files.length) });

  const toggle = (): void => {
    store.updateSettings({ collapsed: { ...store.settings.collapsed, [id]: !collapsed } });
  };
  header.addEventListener("click", toggle);
  header.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter" || evt.key === " ") {
      evt.preventDefault();
      toggle();
    }
  });

  if (collapsed) return;

  const body = sectionEl.createDiv({ cls: "recents-section-body tree-item-children" });
  if (files.length === 0) {
    // Entries can exist but not resolve: an external file on a phone or a missing drive.
    const hidden = paths.length > 0;
    let text = "Nothing opened yet.";
    if (id === "pinned") text = "Nothing pinned yet. Use the pin icon on a file.";
    if (hidden) text = "None of these files can be found on this device.";
    body.createDiv({ cls: "recents-empty", text });
    return;
  }
  const activePath = app.workspace.getActiveFile()?.path ?? null;
  const knownIcons = knownIconIds();
  const pathStyle: PathStyle = {
    absolute: store.settings.absolutePath,
    base: app.vault.adapter instanceof FileSystemAdapter ? app.vault.adapter.getBasePath() : null,
    shorten: store.settings.shortenPath,
  };
  for (const file of files) renderRow(body, host, id, file, activePath, knownIcons, pathStyle);
}

function renderRow(
  body: HTMLElement,
  host: SectionsHost,
  id: SectionId,
  file: TFile,
  activePath: string | null,
  knownIcons: Set<string>,
  pathStyle: PathStyle,
): void {
  const { app, store } = host;
  const row = body.createDiv({ cls: "recents-row tree-item nav-file" });
  const self = row.createDiv({ cls: "recents-row-self tree-item-self nav-file-title is-clickable" });
  self.setAttr("tabindex", "0");
  self.setAttr("draggable", "true");
  self.setAttr("data-path", file.path);
  const external = isExternalPath(file.path);
  setTooltip(self, fullPathLabel(file.path, pathStyle), { delay: store.settings.tooltipDelay });
  self.toggleClass("is-active", file.path === activePath);

  const fileIcon = getFileIcon(app, file.path);
  if (fileIcon) renderIcon(self.createDiv({ cls: "recents-row-icon" }), fileIcon, knownIcons);
  const { pathLocation } = store.settings;
  const text = self.createDiv({ cls: "recents-row-text" });
  text.toggleClass("is-below", pathLocation === "below");
  text.createDiv({ cls: "tree-item-inner nav-file-title-content", text: file.basename });
  const folder = pathLocation === "off" ? "" : folderLabel(file.path, pathStyle);
  if (folder) text.createDiv({ cls: "recents-row-path", text: folder });
  if (file.extension !== "md") self.createDiv({ cls: "nav-file-tag", text: file.extension });

  const actions = self.createDiv({ cls: "recents-row-actions" });
  const pinned = store.isPinned(file.path);
  const pinButton = actions.createDiv({
    cls: "recents-action clickable-icon",
    attr: { "aria-label": pinned ? "Unpin" : "Pin", role: "button" },
  });
  setIcon(pinButton, pinned ? "pin-off" : "pin");
  pinButton.addEventListener("click", (evt) => {
    evt.stopPropagation();
    store.togglePin(file.path);
  });
  if (id === "recent") {
    const removeButton = actions.createDiv({
      cls: "recents-action clickable-icon",
      attr: { "aria-label": "Remove from recent", role: "button" },
    });
    setIcon(removeButton, "x");
    removeButton.addEventListener("click", (evt) => {
      evt.stopPropagation();
      store.removeRecent(file.path);
    });
  }

  self.addEventListener("click", (evt) => host.openFromList(file, Keymap.isModEvent(evt)));
  self.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter") host.openFromList(file, Keymap.isModEvent(evt));
  });
  self.addEventListener("auxclick", (evt) => {
    if (evt.button === 1) {
      evt.preventDefault();
      host.openFromList(file, "tab");
    }
  });
  self.addEventListener("mouseover", (evt) => {
    // Page preview resolves links inside the vault, so skip files outside it.
    if (external) return;
    app.workspace.trigger("hover-link", {
      event: evt,
      source: host.hoverSource,
      hoverParent: host.hoverParent,
      targetEl: row,
      linktext: file.path,
    });
  });
  self.addEventListener("contextmenu", (evt) => showRowMenu(evt, host, id, file));

  attachDrag(self, host, id, file);
}

function showRowMenu(evt: MouseEvent, host: SectionsHost, id: SectionId, file: TFile): void {
  evt.preventDefault();
  const { app, store } = host;
  const menu = new Menu();
  menu.addItem((item) =>
    item
      .setTitle("Open in new tab")
      .setIcon("file-plus")
      .setSection("open")
      .onClick(() => host.openFromList(file, "tab")),
  );
  menu.addItem((item) =>
    item
      .setTitle("Open to the right")
      .setIcon("separator-vertical")
      .setSection("open")
      .onClick(() => host.openFromList(file, "split")),
  );
  const pinned = store.isPinned(file.path);
  menu.addItem((item) =>
    item
      .setTitle(pinned ? "Unpin" : "Pin")
      .setIcon(pinned ? "pin-off" : "pin")
      .setSection("pin")
      .onClick(() => store.togglePin(file.path)),
  );
  if (id === "recent") {
    menu.addItem((item) =>
      item
        .setTitle("Remove from recent")
        .setIcon("x")
        .setSection("pin")
        .onClick(() => store.removeRecent(file.path)),
    );
  }
  app.workspace.trigger("file-menu", menu, file, PANE_MENU_SOURCE);
  menu.showAtMouseEvent(evt);
}

function attachDrag(self: HTMLElement, host: SectionsHost, id: SectionId, file: TFile): void {
  const { app, store } = host;

  self.addEventListener("dragstart", (evt) => {
    if (!evt.dataTransfer) return;
    // Dropping into a note inserts a link, using the user's link format.
    // A file outside the vault has no vault link, so it only supports reordering.
    if (!isExternalPath(file.path)) {
      const sourcePath = app.workspace.getActiveFile()?.path ?? "";
      evt.dataTransfer.setData("text/plain", app.fileManager.generateMarkdownLink(file, sourcePath));
    }
    evt.dataTransfer.effectAllowed = "copyMove";
    if (id === "pinned") draggingPin = file.path;
    self.addClass("is-dragging");
  });

  self.addEventListener("dragend", () => {
    draggingPin = null;
    self.removeClass("is-dragging");
    clearDropMarks(self.closest(".recents-section-body"));
  });

  if (id !== "pinned") return;

  const dropAfter = (evt: DragEvent): boolean => {
    const rect = self.getBoundingClientRect();
    return evt.clientY > rect.top + rect.height / 2;
  };

  self.addEventListener("dragover", (evt) => {
    if (!draggingPin || draggingPin === file.path) return;
    evt.preventDefault();
    clearDropMarks(self.closest(".recents-section-body"));
    self.addClass(dropAfter(evt) ? "drop-after" : "drop-before");
  });

  self.addEventListener("dragleave", () => {
    self.removeClass("drop-before");
    self.removeClass("drop-after");
  });

  self.addEventListener("drop", (evt) => {
    if (!draggingPin || draggingPin === file.path) return;
    evt.preventDefault();
    const from = store.pins.indexOf(draggingPin);
    const targetIndex = store.pins.indexOf(file.path);
    if (from === -1 || targetIndex === -1) return;
    let to = targetIndex + (dropAfter(evt) ? 1 : 0);
    if (from < to) to -= 1;
    draggingPin = null;
    store.reorderPin(from, to);
  });
}

function clearDropMarks(scope: Element | null): void {
  scope?.querySelectorAll(".drop-before, .drop-after").forEach((el) => {
    el.removeClass("drop-before");
    el.removeClass("drop-after");
  });
}
