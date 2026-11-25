import {
  DEFAULT_SETTINGS,
  MAX_ITEMS_LIMIT,
  MAX_KEEP_FOLDERS,
  MAX_TOOLTIP_DELAY,
  type PathLocation,
  type PersistedData,
  type RecentsSettings,
  type SectionOrder,
  type ShortenMode,
  type TooltipMode,
  type TooltipPosition,
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

/**
 * The folder a file is in: the path relative to the vault root for a vault file,
 * the directory on disk for an external one. Empty for a file at the vault root.
 */
export function parentPath(path: string): string {
  const shown = displayPath(path);
  const slash = shown.lastIndexOf("/");
  return slash <= 0 ? "" : shown.slice(0, slash);
}

export interface PathStyle {
  /** Start from the root of the disk. Needs `base`; falls back to the vault path without it. */
  absolute: boolean;
  /** Absolute path of the vault folder, when the platform can say. */
  base: string | null;
}

function normalizeBase(base: string): string {
  return base.replace(/\\/g, "/").replace(/\/+$/, "");
}

function absoluteFrom(base: string, relative: string): string {
  const root = normalizeBase(base);
  if (!relative) return root || "/";
  return root + "/" + relative;
}

/** The folder text for a row in full: relative to the vault root, or absolute. */
export function folderLabel(path: string, style: PathStyle): string {
  const folder = parentPath(path);
  if (style.absolute && style.base && !isExternalPath(path)) return absoluteFrom(style.base, folder);
  return folder;
}

/** The full path of a file, with its name, for a tooltip. */
export function fullPathLabel(path: string, style: PathStyle): string {
  if (style.absolute && style.base && !isExternalPath(path)) return absoluteFrom(style.base, path);
  return displayPath(path);
}

/**
 * The shortest start of `name` that no other folder in `siblings` begins with,
 * so the short form still points at one folder. Leading dots are kept, so
 * ".obsidian" becomes ".o". Without a sibling list, the first letter is used.
 * Comparison ignores case, which can only make the prefix longer.
 */
export function shortSegment(name: string, siblings: string[] | null): string {
  if (name === "" || /^[A-Za-z]:$/.test(name)) return name;
  const dots = name.length - name.replace(/^\.+/, "").length;
  const chars = Array.from(name.slice(dots));
  if (chars.length === 0) return name;
  const lead = name.slice(0, dots);
  if (siblings === null) return lead + chars[0];
  const others = siblings.filter((s) => s !== name).map((s) => s.toLowerCase());
  for (let j = 1; j <= chars.length; j++) {
    const prefix = lead + chars.slice(0, j).join("");
    const lower = prefix.toLowerCase();
    if (!others.some((o) => o.startsWith(lower))) return prefix;
  }
  return name;
}

/** One folder in a path, with the short form it can be cut to. */
export interface FolderSegment {
  name: string;
  short: string;
}

/**
 * Split the folder a file is in into segments that can each be shortened.
 * `siblingsOf` lists the folders inside a vault folder ("" is the vault root),
 * or returns null when it cannot say. Folders outside the vault, on the way to
 * it or holding an external file, use their first letter.
 */
export function folderSegments(
  path: string,
  style: PathStyle,
  siblingsOf: (vaultFolder: string) => string[] | null,
): FolderSegment[] {
  const outside = (name: string): FolderSegment => ({ name, short: shortSegment(name, null) });
  if (isExternalPath(path)) {
    const folder = parentPath(path);
    return folder ? folder.split("/").map(outside) : [];
  }
  const relative = parentPath(path);
  const parts = relative ? relative.split("/") : [];
  const segments: FolderSegment[] = [];
  if (style.absolute && style.base) {
    const base = normalizeBase(style.base);
    segments.push(...(base ? base.split("/") : [""]).map(outside));
  }
  parts.forEach((name, i) => {
    segments.push({ name, short: shortSegment(name, siblingsOf(parts.slice(0, i).join("/"))) });
  });
  return segments;
}

/** Indexes of the segments that may be shortened: every one that gets shorter, except the last `keepLast`. */
export function shortenableIndexes(segments: FolderSegment[], keepLast: number): number[] {
  const limit = segments.length - Math.max(0, keepLast);
  const out: number[] = [];
  for (let i = 0; i < limit; i++) if (segments[i].short !== segments[i].name) out.push(i);
  return out;
}

/** Join segments back into a path, shortening the first `count` shortenable ones. */
export function joinSegments(segments: FolderSegment[], shortenable: number[], count: number): string {
  const cut = new Set(shortenable.slice(0, count));
  const joined = segments.map((s, i) => (cut.has(i) ? s.short : s.name)).join("/");
  return joined === "" && segments.length > 0 ? "/" : joined;
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

function asPathLocation(value: unknown, legacyShow: unknown): PathLocation {
  if (value === "off" || value === "beside" || value === "below") return value;
  // Earlier versions saved a single on/off switch.
  if (legacyShow === false) return "off";
  return DEFAULT_SETTINGS.pathLocation;
}

function asShortenMode(value: unknown, legacyOn: unknown): ShortenMode {
  if (value === "never" || value === "clipped" || value === "always") return value;
  // An earlier version saved a single on/off switch.
  if (legacyOn === true) return "always";
  return DEFAULT_SETTINGS.shortenFolders;
}

function asTooltipMode(value: unknown): TooltipMode {
  return value === "never" || value === "hidden" || value === "always" ? value : DEFAULT_SETTINGS.tooltipMode;
}

function asTooltipPosition(value: unknown): TooltipPosition {
  return value === "top" || value === "bottom" || value === "left" || value === "right"
    ? value
    : DEFAULT_SETTINGS.tooltipPosition;
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
  const delayRaw =
    typeof s.tooltipDelay === "number" && Number.isFinite(s.tooltipDelay) ? s.tooltipDelay : DEFAULT_SETTINGS.tooltipDelay;
  const keepRaw =
    typeof s.keepFolders === "number" && Number.isFinite(s.keepFolders) ? s.keepFolders : DEFAULT_SETTINGS.keepFolders;
  const settings: RecentsSettings = {
    maxItems: Math.min(MAX_ITEMS_LIMIT, Math.max(1, Math.round(maxRaw))),
    showPinned: asBool(s.showPinned, DEFAULT_SETTINGS.showPinned),
    showRecent: asBool(s.showRecent, DEFAULT_SETTINGS.showRecent),
    sectionOrder: asOrder(s.sectionOrder),
    showPinnedInRecent: asBool(
      s.showPinnedInRecent,
      typeof s.hidePinnedFromRecent === "boolean" ? !s.hidePinnedFromRecent : DEFAULT_SETTINGS.showPinnedInRecent,
    ),
    pathLocation: asPathLocation(s.pathLocation, s.showPath),
    shortenFolders: asShortenMode(s.shortenFolders, s.shortenPath),
    keepFolders: Math.min(MAX_KEEP_FOLDERS, Math.max(0, Math.round(keepRaw))),
    absolutePath: asBool(s.absolutePath, DEFAULT_SETTINGS.absolutePath),
    tooltipMode: asTooltipMode(s.tooltipMode),
    tooltipPosition: asTooltipPosition(s.tooltipPosition),
    tooltipDelay: Math.min(MAX_TOOLTIP_DELAY, Math.max(0, Math.round(delayRaw))),
    highlightActive: asBool(s.highlightActive, DEFAULT_SETTINGS.highlightActive),
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
