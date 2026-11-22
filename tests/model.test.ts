import { describe, expect, it } from "vitest";
import {
  compilePatterns,
  displayPath,
  isExternalPath,
  matchesAny,
  movePin,
  parentPath,
  recordOpen,
  removePaths,
  renamePaths,
  sanitize,
  sanitizeRecents,
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

  it("keeps the tooltip delay between 0 and 2000", () => {
    expect(sanitize({ settings: { tooltipDelay: -5 } }).settings.tooltipDelay).toBe(0);
    expect(sanitize({ settings: { tooltipDelay: 99999 } }).settings.tooltipDelay).toBe(2000);
    expect(sanitize({ settings: { tooltipDelay: "x" } }).settings.tooltipDelay).toBe(100);
    expect(sanitize({ settings: { tooltipDelay: 0 } }).settings.tooltipDelay).toBe(0);
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
