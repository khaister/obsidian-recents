import { describe, expect, it } from "vitest";
import {
  compilePatterns,
  displayPath,
  folderLabel,
  fullPathLabel,
  isExternalPath,
  matchesAny,
  movePin,
  parentPath,
  recordOpen,
  folderSegments,
  joinSegments,
  shortSegment,
  shortenableIndexes,
  removePaths,
  renamePaths,
  sanitize,
  sanitizeRecents,
  type PathStyle,
} from "../src/model";
import { DEFAULT_SETTINGS } from "../src/types";

describe("recordOpen", () => {
  it("moves a reopened file to the front without duplicating it", () => {
    expect(recordOpen(["a", "b", "c"], "c", 10)).toEqual(["c", "a", "b"]);
  });

  it("caps the list and drops the oldest", () => {
    expect(recordOpen(["a", "b", "c"], "d", 3)).toEqual(["d", "a", "b"]);
  });

  it("never caps below one", () => {
    expect(recordOpen(["a"], "b", 0)).toEqual(["b"]);
  });
});

describe("renamePaths and removePaths", () => {
  it("renames a file", () => {
    expect(renamePaths(["a.md", "b.md"], "a.md", "c.md")).toEqual(["c.md", "b.md"]);
  });

  it("renames everything under a folder", () => {
    expect(renamePaths(["notes/a.md", "notes/sub/b.md", "notesx/c.md"], "notes", "docs")).toEqual([
      "docs/a.md",
      "docs/sub/b.md",
      "notesx/c.md",
    ]);
  });

  it("does not leave duplicates when a rename collides", () => {
    expect(renamePaths(["a.md", "b.md"], "a.md", "b.md")).toEqual(["b.md"]);
  });

  it("removes a folder and its children but not a sibling with a shared prefix", () => {
    expect(removePaths(["notes/a.md", "notes/sub/b.md", "notesx/c.md"], "notes")).toEqual(["notesx/c.md"]);
  });
});

describe("movePin", () => {
  it("moves an item forward and back", () => {
    expect(movePin(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(movePin(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("returns the same array when nothing moves", () => {
    const pins = ["a", "b"];
    expect(movePin(pins, 1, 1)).toBe(pins);
    expect(movePin(pins, 5, 0)).toBe(pins);
  });

  it("clamps the target", () => {
    expect(movePin(["a", "b", "c"], 0, 99)).toEqual(["b", "c", "a"]);
  });
});

describe("path patterns", () => {
  it("skips blank lines and reports invalid patterns instead of throwing", () => {
    const { regexes, invalid } = compilePatterns(["^daily/", "  ", "([unclosed"]);
    expect(regexes).toHaveLength(1);
    expect(invalid).toEqual(["([unclosed"]);
    expect(matchesAny("daily/2026-01-01.md", regexes)).toBe(true);
    expect(matchesAny("notes/a.md", regexes)).toBe(false);
  });
});

describe("sanitize", () => {
  it("returns defaults for missing or malformed data", () => {
    expect(sanitize(null).settings).toEqual(DEFAULT_SETTINGS);
    expect(sanitize("nope").pins).toEqual([]);
    expect(sanitize({ settings: 5, pins: "x" })).toEqual({ settings: DEFAULT_SETTINGS, pins: [] });
  });

  it("keeps valid values and fixes bad ones", () => {
    const out = sanitize({
      settings: { maxItems: 9999, showPinned: "yes", sectionOrder: "recent-first", collapsed: { pinned: true } },
      pins: ["a", "a", 3, "b"],
    });
    expect(out.settings.maxItems).toBe(500);
    expect(out.settings.showPinned).toBe(true);
    expect(out.settings.sectionOrder).toBe("recent-first");
    expect(out.settings.collapsed).toEqual({ pinned: true, recent: false });
    expect(out.pins).toEqual(["a", "b"]);
  });

  it("shows pinned files in recent by default and reads the old hide setting", () => {
    expect(sanitize({}).settings.showPinnedInRecent).toBe(true);
    expect(sanitize({ settings: { hidePinnedFromRecent: true } }).settings.showPinnedInRecent).toBe(false);
    expect(sanitize({ settings: { hidePinnedFromRecent: false } }).settings.showPinnedInRecent).toBe(true);
    expect(
      sanitize({ settings: { showPinnedInRecent: true, hidePinnedFromRecent: true } }).settings.showPinnedInRecent,
    ).toBe(true);
  });

  it("keeps the tooltip delay between 0 and 2000", () => {
    expect(sanitize({ settings: { tooltipDelay: -5 } }).settings.tooltipDelay).toBe(0);
    expect(sanitize({ settings: { tooltipDelay: 99999 } }).settings.tooltipDelay).toBe(2000);
    expect(sanitize({ settings: { tooltipDelay: "x" } }).settings.tooltipDelay).toBe(100);
    expect(sanitize({ settings: { tooltipDelay: 0 } }).settings.tooltipDelay).toBe(0);
  });

  it("defaults the tooltip to when hidden and rejects unknown modes", () => {
    expect(sanitize({}).settings.tooltipMode).toBe("hidden");
    expect(sanitize({ settings: { tooltipMode: "always" } }).settings.tooltipMode).toBe("always");
    expect(sanitize({ settings: { tooltipMode: "sometimes" } }).settings.tooltipMode).toBe("hidden");
  });

  it("defaults the tooltip position to below and rejects unknown sides", () => {
    expect(sanitize({}).settings.tooltipPosition).toBe("bottom");
    expect(sanitize({ settings: { tooltipPosition: "left" } }).settings.tooltipPosition).toBe("left");
    expect(sanitize({ settings: { tooltipPosition: "middle" } }).settings.tooltipPosition).toBe("bottom");
  });

  it("sanitizes the recents list", () => {
    expect(sanitizeRecents(["a", "a", 1, "b", "c"], 2)).toEqual(["a", "b"]);
    expect(sanitizeRecents({}, 5)).toEqual([]);
  });
});

describe("external files", () => {
  it("recognizes the file: prefix Obsidian gives files outside the vault", () => {
    expect(isExternalPath("file:/Users/me/notes/a.md")).toBe(true);
    expect(isExternalPath("file:C:/Users/me/a.md")).toBe(true);
    expect(isExternalPath("notes/a.md")).toBe(false);
    expect(isExternalPath("filesystem/a.md")).toBe(false);
  });

  it("shows the path on disk without the prefix", () => {
    expect(displayPath("file:/Users/me/a.md")).toBe("/Users/me/a.md");
    expect(displayPath("notes/a.md")).toBe("notes/a.md");
  });

  it("gives the folder a file is in", () => {
    expect(parentPath("notes/sub/a.md")).toBe("notes/sub");
    expect(parentPath("a.md")).toBe("");
    expect(parentPath("file:/Users/me/docs/a.md")).toBe("/Users/me/docs");
    expect(parentPath("file:C:/Users/me/a.md")).toBe("C:/Users/me");
    expect(parentPath("file:/a.md")).toBe("");
  });

  it("follows a rename of an external file in both lists", () => {
    const paths = ["file:/Users/me/a.md", "notes/b.md"];
    expect(renamePaths(paths, "file:/Users/me/a.md", "file:/Users/me/c.md")).toEqual([
      "file:/Users/me/c.md",
      "notes/b.md",
    ]);
  });
});

describe("path display", () => {
  const relative: PathStyle = { absolute: false, base: null };
  // home holds improvements and inventory; improvements holds bathroom.
  const tree: Record<string, string[]> = {
    "": ["home", "hobbies", ".obsidian"],
    home: ["improvements", "inventory"],
    "home/improvements": ["bathroom"],
  };
  const siblingsOf = (folder: string): string[] | null => tree[folder] ?? null;
  const cutAll = (path: string, keep: number, style = relative): string => {
    const segments = folderSegments(path, style, siblingsOf);
    const shortenable = shortenableIndexes(segments, keep);
    return joinSegments(segments, shortenable, shortenable.length);
  };

  it("cuts a folder to the shortest start no sibling shares", () => {
    expect(shortSegment("improvements", ["improvements", "inventory"])).toBe("im");
    expect(shortSegment("home", ["home", "hobbies"])).toBe("hom");
    expect(shortSegment("bathroom", ["bathroom"])).toBe("b");
    expect(shortSegment("Notes", ["notes-old", "Notes"])).toBe("Notes");
  });

  it("keeps leading dots and drive letters", () => {
    expect(shortSegment(".obsidian", [".obsidian", "home"])).toBe(".o");
    expect(shortSegment(".obsidian", null)).toBe(".o");
    expect(shortSegment("C:", null)).toBe("C:");
    expect(shortSegment("Users", null)).toBe("U");
  });

  it("keeps the innermost folders whole", () => {
    expect(cutAll("home/improvements/bathroom/README.md", 1)).toBe("hom/im/bathroom");
    expect(cutAll("home/improvements/bathroom/README.md", 0)).toBe("hom/im/b");
    expect(cutAll("home/improvements/bathroom/README.md", 5)).toBe("home/improvements/bathroom");
  });

  it("shortens from the left, one folder at a time", () => {
    const segments = folderSegments("home/improvements/bathroom/README.md", relative, siblingsOf);
    const shortenable = shortenableIndexes(segments, 1);
    expect(joinSegments(segments, shortenable, 0)).toBe("home/improvements/bathroom");
    expect(joinSegments(segments, shortenable, 1)).toBe("hom/improvements/bathroom");
    expect(joinSegments(segments, shortenable, 2)).toBe("hom/im/bathroom");
  });

  it("labels a folder relative to the vault", () => {
    expect(folderLabel("home/improvements/README.md", relative)).toBe("home/improvements");
    expect(folderLabel("README.md", relative)).toBe("");
  });

  it("starts at the disk root when asked and the vault location is known", () => {
    const style = { absolute: true, base: "/Users/me/vault" };
    expect(folderLabel("home/README.md", style)).toBe("/Users/me/vault/home");
    expect(folderLabel("README.md", style)).toBe("/Users/me/vault");
    expect(cutAll("home/improvements/README.md", 1, style)).toBe("/U/m/v/hom/improvements");
    expect(folderLabel("home/README.md", { ...style, base: "C:\\Users\\me\\vault\\" })).toBe("C:/Users/me/vault/home");
  });

  it("falls back to the vault path when the vault location is unknown", () => {
    expect(folderLabel("home/README.md", { absolute: true, base: null })).toBe("home");
  });

  it("never rewrites the path of an external file", () => {
    const style = { absolute: true, base: "/Users/me/vault" };
    expect(folderLabel("file:/Users/me/docs/a.md", style)).toBe("/Users/me/docs");
    expect(fullPathLabel("file:/Users/me/docs/a.md", style)).toBe("/Users/me/docs/a.md");
  });

  it("gives the full path for a tooltip", () => {
    expect(fullPathLabel("home/README.md", relative)).toBe("home/README.md");
    expect(fullPathLabel("home/README.md", { absolute: true, base: "/Users/me/vault" })).toBe("/Users/me/vault/home/README.md");
  });

  it("reads the old shorten switch", () => {
    expect(sanitize({ settings: { shortenPath: true } }).settings.shortenFolders).toBe("always");
    expect(sanitize({ settings: { shortenPath: false } }).settings.shortenFolders).toBe("never");
    expect(sanitize({ settings: { shortenFolders: "clipped", shortenPath: true } }).settings.shortenFolders).toBe("clipped");
    expect(sanitize({}).settings.shortenFolders).toBe("never");
  });

  it("reads the old show-path switch", () => {
    expect(sanitize({ settings: { showPath: false } }).settings.pathLocation).toBe("off");
    expect(sanitize({ settings: { showPath: true } }).settings.pathLocation).toBe("beside");
    expect(sanitize({ settings: { pathLocation: "below", showPath: false } }).settings.pathLocation).toBe("below");
    expect(sanitize({}).settings.pathLocation).toBe("beside");
  });
});
