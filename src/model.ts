import {
  DEFAULT_SETTINGS,
  MAX_ITEMS_LIMIT,
  type PersistedData,
  type RecentsSettings,
  type SectionOrder,
} from "./types";

/** Obsidian addresses a file outside the vault as "file:" plus its absolute path. */
export const EXTERNAL_PREFIX = "file:";

export function isExternalPath(path: string): boolean {
  return path.startsWith(EXTERNAL_PREFIX);
}

/** The path on disk for an external file, or the path unchanged for a vault file. */
export function displayPath(path: string): string {
  return isExternalPath(path) ? path.slice(EXTERNAL_PREFIX.length) : path;
}

/** Put `path` at the front, drop duplicates, and cap the length. */
export function recordOpen(list: string[], path: string, max: number): string[] {
  const next = [path, ...list.filter((p) => p !== path)];
  return next.slice(0, Math.max(1, max));
}

function isSameOrChild(path: string, parent: string): boolean {
  return path === parent || path.startsWith(parent + "/");
}

/**
 * Rewrite paths after a rename. A folder rename moves everything under it, and
 * Obsidian does not promise a separate event for each child, so match by prefix.
 */
export function renamePaths(paths: string[], oldPath: string, newPath: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of paths) {
    const moved = isSameOrChild(p, oldPath) ? newPath + p.slice(oldPath.length) : p;
    if (!seen.has(moved)) {
      seen.add(moved);
      out.push(moved);
    }
  }
  return out;
}

/** Drop a path and, when it was a folder, everything under it. */
export function removePaths(paths: string[], removed: string): string[] {
  return paths.filter((p) => !isSameOrChild(p, removed));
}

export function movePin(pins: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || from >= pins.length) return pins;
  const clamped = Math.min(Math.max(to, 0), pins.length - 1);
  const next = pins.slice();
  const [item] = next.splice(from, 1);
  next.splice(clamped, 0, item);
  return next;
}

export interface CompiledPatterns {
  regexes: RegExp[];
  invalid: string[];
}

export function compilePatterns(lines: string[]): CompiledPatterns {
  const regexes: RegExp[] = [];
  const invalid: string[] = [];
  for (const line of lines) {
    const pattern = line.trim();
    if (!pattern) continue;
    try {
      regexes.push(new RegExp(pattern));
    } catch {
      invalid.push(pattern);
    }
  }
  return { regexes, invalid };
}

export function matchesAny(path: string, regexes: RegExp[]): boolean {
  return regexes.some((re) => re.test(path));
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asOrder(value: unknown): SectionOrder {
  return value === "recent-first" ? "recent-first" : "pinned-first";
}

/** Turn whatever data.json holds into valid data. Never throws. */
export function sanitize(raw: unknown): PersistedData {
  const root = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const s = (typeof root.settings === "object" && root.settings !== null
    ? root.settings
    : {}) as Record<string, unknown>;
  const collapsed = (typeof s.collapsed === "object" && s.collapsed !== null
    ? s.collapsed
    : {}) as Record<string, unknown>;

  const maxRaw = typeof s.maxItems === "number" && Number.isFinite(s.maxItems) ? s.maxItems : DEFAULT_SETTINGS.maxItems;
  const settings: RecentsSettings = {
    maxItems: Math.min(MAX_ITEMS_LIMIT, Math.max(1, Math.round(maxRaw))),
    showPinned: asBool(s.showPinned, DEFAULT_SETTINGS.showPinned),
    showRecent: asBool(s.showRecent, DEFAULT_SETTINGS.showRecent),
    sectionOrder: asOrder(s.sectionOrder),
    hidePinnedFromRecent: asBool(s.hidePinnedFromRecent, DEFAULT_SETTINGS.hidePinnedFromRecent),
    focusExistingTab: asBool(s.focusExistingTab, DEFAULT_SETTINGS.focusExistingTab),
    keepOrderOnListClick: asBool(s.keepOrderOnListClick, DEFAULT_SETTINGS.keepOrderOnListClick),
    omittedPaths: asStringArray(s.omittedPaths),
    collapsed: {
      pinned: asBool(collapsed.pinned, false),
      recent: asBool(collapsed.recent, false),
    },
  };

  const pins = [...new Set(asStringArray(root.pins))];
  return { settings, pins };
}

/** Read the per-device recents list. Anything else becomes an empty list. */
export function sanitizeRecents(raw: unknown, max: number): string[] {
  return [...new Set(asStringArray(raw))].slice(0, Math.max(1, max));
}
