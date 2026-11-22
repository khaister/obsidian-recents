import { FileView, type App, type PaneType, type TFile, type WorkspaceLeaf } from "obsidian";

/** The first open tab, in any pane or window, that shows this file. */
export function findLeafShowing(app: App, path: string): WorkspaceLeaf | null {
  const matches: WorkspaceLeaf[] = [];
  app.workspace.iterateAllLeaves((leaf) => {
    if (leaf.view instanceof FileView && leaf.view.file?.path === path) matches.push(leaf);
  });
  return matches[0] ?? null;
}

/**
 * Open a file. A plain click switches to the tab that already shows it when
 * `focusExisting` is on. Any modifier click opens a new tab or split as asked.
 */
export async function openFile(
  app: App,
  file: TFile,
  mode: PaneType | boolean,
  focusExisting: boolean,
): Promise<void> {
  if (mode === false && focusExisting) {
    const existing = findLeafShowing(app, file.path);
    if (existing) {
      app.workspace.setActiveLeaf(existing, { focus: true });
      await app.workspace.revealLeaf(existing);
      return;
    }
  }
  await app.workspace.getLeaf(mode).openFile(file);
}
