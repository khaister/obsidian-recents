import { FileSystemAdapter, Keymap, Menu, TFolder, setIcon, setTooltip, type App, type HoverParent, type PaneType, type TFile } from "obsidian";
import { getFileIcon, knownIconIds, renderIcon } from "./iconic";
import {
  folderLabel,
  folderSegments,
  fullPathLabel,
  isExternalPath,
  shortenableIndexes,
  type FolderSegment,
  type PathStyle,
} from "./model";
import type { Store } from "./store";
import type { SectionId, TooltipPosition } from "./types";

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
export function renderSections(container: HTMLElement, host: SectionsHost): () => void {
  container.empty();
  const fits: RowFit[] = [];
  const { settings, pins, recents } = host.store;

  const pinned = pins;
  const recent = settings.showPinnedInRecent ? recents : recents.filter((p) => !pins.includes(p));

  const sections: { id: SectionId; title: string; paths: string[]; visible: boolean }[] = [
    { id: "pinned", title: "Pinned", paths: pinned, visible: settings.showPinned },
    { id: "recent", title: "Recent", paths: recent, visible: settings.showRecent },
  ];
  if (settings.sectionOrder === "recent-first") sections.reverse();

  const visible = sections.filter((s) => s.visible);
  if (visible.length === 0) {
    container.createDiv({ cls: "recents-empty", text: "Both sections are hidden. Turn one on in the Recents settings." });
    return () => undefined;
  }
  for (const section of visible) renderSection(container, host, section.id, section.title, section.paths, fits);
  return watchFit(container, fits);
}

/**
 * A row whose path or tooltip depends on how much room it has, so it is
 * checked again whenever the pane changes width.
 */
interface RowFit {
  self: HTMLElement;
  nameEl: HTMLElement;
  pathEl: HTMLElement | null;
  segments: FolderSegment[];
  shortenable: number[];
  /** How many segments to shorten: try each count from `minCut` up until the path fits. */
  minCut: number;
  maxCut: number;
  /** The file has a folder, but the row does not show it. */
  pathOff: boolean;
  /** Lines the path may take before it counts as clipped. */
  maxLines: number;
  /** Full path for the tooltip, or null when the tooltip does not depend on fit. */
  tooltip: string | null;
  delay: number;
  placement: TooltipPosition;
}

/** Draw a path with its first `count` shortenable segments cut, marking the cut ones. */
function drawPath(el: HTMLElement, segments: FolderSegment[], shortenable: number[], count: number): void {
  el.empty();
  const cut = new Set(shortenable.slice(0, count));
  segments.forEach((segment, i) => {
    if (i > 0) el.appendText("/");
    if (cut.has(i)) el.createSpan({ cls: "recents-path-short", text: segment.short });
    else el.appendText(segment.name);
  });
  if (segments.length === 1 && segments[0].name === "") el.setText("/");
}

/** Below the name a path may wrap this far before it is shortened. */
const BELOW_MAX_LINES = 2;

function overflows(el: HTMLElement, maxLines: number): boolean {
  if (maxLines <= 1) {
    el.addClass("is-measuring");
    const clipped = el.scrollWidth > el.clientWidth;
    el.removeClass("is-measuring");
    return clipped;
  }
  const style = getComputedStyle(el);
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.3;
  return el.scrollHeight > lineHeight * maxLines + 1;
}

function fitRow(fit: RowFit): void {
  const { pathEl, segments, shortenable, maxLines } = fit;
  let pathShown = !fit.pathOff;
  if (pathEl) {
    // Shorten one more folder at a time, from the left, until the path fits.
    let count = fit.minCut;
    drawPath(pathEl, segments, shortenable, count);
    let clipped = overflows(pathEl, maxLines);
    while (clipped && count < fit.maxCut) {
      count++;
      drawPath(pathEl, segments, shortenable, count);
      clipped = overflows(pathEl, maxLines);
    }
    // Shortened, or cut off with an ellipsis. Below the name a long path wraps, so it stays whole.
    pathShown = count === 0 && !(clipped && maxLines <= 1);
  }
  if (fit.tooltip === null) return;
  const nameShown = fit.nameEl.scrollWidth <= fit.nameEl.clientWidth;
  setRowTooltip(fit.self, pathShown && nameShown ? "" : fit.tooltip, fit.delay, fit.placement);
}

/** Set a row's tooltip. An empty text means none. */
function setRowTooltip(el: HTMLElement, text: string, delay: number, placement: TooltipPosition): void {
  setTooltip(el, text, { delay, placement });
  // Obsidian skips a delay of 0 and falls back to its own, so set it here.
  if (delay === 0) el.setAttr("data-tooltip-delay", "0");
}

/** Fit every row now and again whenever the pane changes width. Returns a function that stops watching. */
function watchFit(container: HTMLElement, fits: RowFit[]): () => void {
  if (fits.length === 0) return () => undefined;
  const fitAll = (): void => fits.forEach(fitRow);
  fitAll();
  let lastWidth = container.clientWidth;
  const observer = new ResizeObserver(() => {
    if (container.clientWidth === lastWidth) return;
    lastWidth = container.clientWidth;
    fitAll();
  });
  observer.observe(container);
  return () => observer.disconnect();
}

function renderSection(
  container: HTMLElement,
  host: SectionsHost,
  id: SectionId,
  title: string,
  paths: string[],
  fits: RowFit[],
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
  const activePath = store.settings.highlightActive ? (app.workspace.getActiveFile()?.path ?? null) : null;
  const knownIcons = knownIconIds();
  const pathStyle: PathStyle = {
    absolute: store.settings.absolutePath,
    base: app.vault.adapter instanceof FileSystemAdapter ? app.vault.adapter.getBasePath() : null,
  };
  const siblingsOf = folderLister(app);
  const context: RowContext = { activePath, knownIcons, pathStyle, siblingsOf, fits };
  for (const file of files) renderRow(body, host, id, file, context);
}

interface RowContext {
  activePath: string | null;
  knownIcons: Set<string>;
  pathStyle: PathStyle;
  siblingsOf: (vaultFolder: string) => string[] | null;
  fits: RowFit[];
}

/** Lists the folders inside a vault folder, remembering each answer for one draw. */
function folderLister(app: App): (vaultFolder: string) => string[] | null {
  const cache = new Map<string, string[] | null>();
  return (vaultFolder) => {
    const cached = cache.get(vaultFolder);
    if (cached !== undefined) return cached;
    const folder = vaultFolder === "" ? app.vault.getRoot() : app.vault.getFolderByPath(vaultFolder);
    const names = folder ? folder.children.filter((c) => c instanceof TFolder).map((c) => c.name) : null;
    cache.set(vaultFolder, names);
    return names;
  };
}

function renderRow(
  body: HTMLElement,
  host: SectionsHost,
  id: SectionId,
  file: TFile,
  context: RowContext,
): void {
  const { app, store } = host;
  const { activePath, knownIcons, pathStyle, fits } = context;
  const row = body.createDiv({ cls: "recents-row tree-item nav-file" });
  const self = row.createDiv({ cls: "recents-row-self tree-item-self nav-file-title is-clickable" });
  self.setAttr("tabindex", "0");
  self.setAttr("draggable", "true");
  self.setAttr("data-path", file.path);
  const external = isExternalPath(file.path);
  const { tooltipMode, tooltipDelay, tooltipPosition } = store.settings;
  const tooltip = fullPathLabel(file.path, pathStyle);
  if (tooltipMode === "always") setRowTooltip(self, tooltip, tooltipDelay, tooltipPosition);
  self.toggleClass("is-active", file.path === activePath);

  const fileIcon = getFileIcon(app, file.path);
  if (fileIcon) renderIcon(self.createDiv({ cls: "recents-row-icon" }), fileIcon, knownIcons);
  const { pathLocation } = store.settings;
  const text = self.createDiv({ cls: "recents-row-text" });
  text.toggleClass("is-below", pathLocation === "below");
  self.toggleClass("has-path-below", pathLocation === "below");
  const nameEl = text.createDiv({ cls: "tree-item-inner nav-file-title-content", text: file.basename });
  const { shortenFolders, keepFolders } = store.settings;
  const hasFolder = folderLabel(file.path, pathStyle) !== "";
  const segments = hasFolder ? folderSegments(file.path, pathStyle, context.siblingsOf) : [];
  const shortenable = shortenableIndexes(segments, keepFolders);
  const pathEl = hasFolder && pathLocation !== "off" ? text.createDiv({ cls: "recents-row-path" }) : null;
  const all = shortenable.length;
  const minCut = shortenFolders === "always" ? all : 0;
  const maxCut = shortenFolders === "never" ? 0 : all;
  const fitsTooltip = tooltipMode === "hidden";
  if (pathEl) drawPath(pathEl, segments, shortenable, minCut);
  if ((pathEl && maxCut > minCut) || fitsTooltip) {
    fits.push({
      self,
      nameEl,
      pathEl,
      segments,
      shortenable,
      minCut,
      maxCut,
      pathOff: hasFolder && pathEl === null,
      maxLines: pathLocation === "below" ? BELOW_MAX_LINES : 1,
      tooltip: fitsTooltip ? tooltip : null,
      delay: tooltipDelay,
      placement: tooltipPosition,
    });
  }
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
