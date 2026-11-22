import { getIconIds, setIcon, type App } from "obsidian";
import { isExternalPath } from "./model";

/** An icon a user assigned to a file in the Iconic plugin. */
export interface FileIcon {
  /** A Lucide icon id, or an emoji. */
  icon: string;
  /** An Iconic color name or any CSS color. */
  color: string | null;
}

interface IconicItem {
  id?: string;
  icon?: string | null;
  color?: string | null;
}

/**
 * The slice of Iconic used here. Iconic documents no API for other plugins, so
 * every member is optional and checked before use: a change inside Iconic
 * means no icons, never an error.
 */
interface IconicPlugin {
  getFileItem?(path: string): IconicItem | undefined;
  ruleManager?: {
    checkRuling?(category: string, id: string): IconicItem | undefined | null;
  } | null;
}

/** Iconic's named colors, mapped to the theme variables it reads them from. */
const THEME_COLORS: Record<string, string> = {
  red: "--color-red",
  orange: "--color-orange",
  yellow: "--color-yellow",
  green: "--color-green",
  cyan: "--color-cyan",
  blue: "--color-blue",
  purple: "--color-purple",
  pink: "--color-pink",
  gray: "--color-base-70",
};

function findIconic(app: App): IconicPlugin | null {
  const registry = (app as unknown as { plugins?: { plugins?: Record<string, unknown> } }).plugins?.plugins;
  const plugin = registry?.["iconic"];
  return typeof plugin === "object" && plugin !== null ? plugin : null;
}

/**
 * The icon Iconic shows for a file, or null when Iconic is off or the file has
 * none. Rules win over a hand-picked icon, the same order Iconic itself uses.
 */
export function getFileIcon(app: App, path: string): FileIcon | null {
  if (isExternalPath(path)) return null;
  const iconic = findIconic(app);
  if (!iconic || typeof iconic.getFileItem !== "function") return null;
  try {
    const item = iconic.getFileItem(path);
    if (!item) return null;
    const effective = iconic.ruleManager?.checkRuling?.("file", item.id ?? path) ?? item;
    if (typeof effective.icon !== "string" || effective.icon === "") return null;
    return { icon: effective.icon, color: typeof effective.color === "string" ? effective.color : null };
  } catch {
    return null;
  }
}

function cssColor(color: string | null): string | null {
  if (!color) return null;
  const themeVar = THEME_COLORS[color];
  if (themeVar) return `var(${themeVar})`;
  return CSS.supports("color", color) ? color : null;
}

/** Ids Obsidian can draw. Build once per render and pass to `renderIcon`. */
export function knownIconIds(): Set<string> {
  return new Set<string>(getIconIds());
}

/** Draw `icon` into `el`: a Lucide icon when Obsidian knows the id, otherwise an emoji. */
export function renderIcon(el: HTMLElement, icon: FileIcon, known: Set<string>): void {
  if (known.has(icon.icon)) {
    setIcon(el, icon.icon);
    const color = cssColor(icon.color);
    if (color) el.setCssProps({ color });
  } else {
    el.createSpan({ cls: "recents-emoji", text: icon.icon });
  }
}
