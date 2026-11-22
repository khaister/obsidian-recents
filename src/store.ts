import {
  compilePatterns,
  matchesAny,
  movePin,
  recordOpen,
  removePaths,
  renamePaths,
  sanitize,
  sanitizeRecents,
  type CompiledPatterns,
} from "./model";
import type { PersistedData, RecentsSettings } from "./types";

export interface Persistence {
  /** Save pins and settings. Synced with the vault. */
  saveData(data: PersistedData): void;
  /** Save the recent list. Stays on this device. */
  saveRecents(recents: string[]): void;
}

export interface InitialState {
  data: unknown;
  recents: unknown;
}

/** Holds the pins, the recent list and the settings. No Obsidian imports. */
export class Store {
  public settings: RecentsSettings;
  public pins: string[];
  public recents: string[];

  private readonly listeners = new Set<() => void>();
  private patterns: CompiledPatterns;

  public constructor(
    private readonly persistence: Persistence,
    initial: InitialState,
  ) {
    const data = sanitize(initial.data);
    this.settings = data.settings;
    this.pins = data.pins;
    this.recents = sanitizeRecents(initial.recents, this.settings.maxItems);
    this.patterns = compilePatterns(this.settings.omittedPaths);
  }

  /** Subscribe to changes. Returns the unsubscribe function. */
  public onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Replace pins and settings after data.json changed outside this session. */
  public reloadData(raw: unknown): void {
    const data = sanitize(raw);
    this.settings = data.settings;
    this.pins = data.pins;
    this.patterns = compilePatterns(this.settings.omittedPaths);
    this.recents = this.recents.slice(0, this.settings.maxItems);
    this.emit();
  }

  /** Ask views to redraw without changing any data, for example once the vault is indexed. */
  public refresh(): void {
    this.emit();
  }

  public get invalidPathPatterns(): string[] {
    return this.patterns.invalid;
  }

  public pathOmitted(path: string): boolean {
    return matchesAny(path, this.patterns.regexes);
  }

  public isPinned(path: string): boolean {
    return this.pins.includes(path);
  }

  public pin(path: string): void {
    if (this.isPinned(path)) return;
    this.pins = [...this.pins, path];
    this.savePins();
  }

  public unpin(path: string): void {
    if (!this.isPinned(path)) return;
    this.pins = this.pins.filter((p) => p !== path);
    this.savePins();
  }

  public togglePin(path: string): void {
    if (this.isPinned(path)) this.unpin(path);
    else this.pin(path);
  }

  public reorderPin(from: number, to: number): void {
    const next = movePin(this.pins, from, to);
    if (next === this.pins) return;
    this.pins = next;
    this.savePins();
  }

  public recordOpen(path: string): void {
    if (this.recents[0] === path) return;
    this.recents = recordOpen(this.recents, path, this.settings.maxItems);
    this.saveRecents();
  }

  public removeRecent(path: string): void {
    if (!this.recents.includes(path)) return;
    this.recents = this.recents.filter((p) => p !== path);
    this.saveRecents();
  }

  public clearRecents(): void {
    if (this.recents.length === 0) return;
    this.recents = [];
    this.saveRecents();
  }

  /** Keep only recents that pass `keep`, for example after the omit rules change. */
  public pruneRecents(keep: (path: string) => boolean): void {
    const next = this.recents.filter(keep);
    if (next.length === this.recents.length) return;
    this.recents = next;
    this.saveRecents();
  }

  public rename(oldPath: string, newPath: string): void {
    const pins = renamePaths(this.pins, oldPath, newPath);
    const recents = renamePaths(this.recents, oldPath, newPath);
    const pinsChanged = pins.join("\n") !== this.pins.join("\n");
    const recentsChanged = recents.join("\n") !== this.recents.join("\n");
    this.pins = pins;
    this.recents = recents;
    if (pinsChanged) this.persistence.saveData(this.snapshot());
    if (recentsChanged) this.persistence.saveRecents(this.recents);
    if (pinsChanged || recentsChanged) this.emit();
  }

  public remove(path: string): void {
    const pins = removePaths(this.pins, path);
    const recents = removePaths(this.recents, path);
    const pinsChanged = pins.length !== this.pins.length;
    const recentsChanged = recents.length !== this.recents.length;
    this.pins = pins;
    this.recents = recents;
    if (pinsChanged) this.persistence.saveData(this.snapshot());
    if (recentsChanged) this.persistence.saveRecents(this.recents);
    if (pinsChanged || recentsChanged) this.emit();
  }

  public updateSettings(patch: Partial<RecentsSettings>): void {
    this.settings = { ...this.settings, ...patch };
    if (patch.omittedPaths) this.patterns = compilePatterns(this.settings.omittedPaths);
    if (patch.maxItems !== undefined && this.recents.length > this.settings.maxItems) {
      this.recents = this.recents.slice(0, this.settings.maxItems);
      this.persistence.saveRecents(this.recents);
    }
    this.persistence.saveData(this.snapshot());
    this.emit();
  }

  public snapshot(): PersistedData {
    return { settings: this.settings, pins: this.pins };
  }

  private savePins(): void {
    this.persistence.saveData(this.snapshot());
    this.emit();
  }

  private saveRecents(): void {
    this.persistence.saveRecents(this.recents);
    this.emit();
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }
}
