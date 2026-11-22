import { describe, expect, it, vi } from "vitest";
import { Store } from "../src/store";

function makeStore(initial: { data?: unknown; recents?: unknown } = {}) {
  const saveData = vi.fn();
  const saveRecents = vi.fn();
  const store = new Store({ saveData, saveRecents }, { data: initial.data ?? null, recents: initial.recents ?? [] });
  return { store, saveData, saveRecents };
}

describe("pins", () => {
  it("pins once, unpins, and saves only when something changed", () => {
    const { store, saveData } = makeStore();
    store.pin("a.md");
    store.pin("a.md");
    expect(store.pins).toEqual(["a.md"]);
    expect(saveData).toHaveBeenCalledTimes(1);
    store.unpin("zzz.md");
    expect(saveData).toHaveBeenCalledTimes(1);
    store.unpin("a.md");
    expect(store.pins).toEqual([]);
    expect(saveData).toHaveBeenCalledTimes(2);
  });

  it("reorders pins", () => {
    const { store } = makeStore({ data: { pins: ["a", "b", "c"] } });
    store.reorderPin(0, 2);
    expect(store.pins).toEqual(["b", "c", "a"]);
  });
});

describe("recents", () => {
  it("records opens at the front and keeps them on this device only", () => {
    const { store, saveData, saveRecents } = makeStore();
    store.recordOpen("a.md");
    store.recordOpen("b.md");
    expect(store.recents).toEqual(["b.md", "a.md"]);
    expect(saveRecents).toHaveBeenCalledTimes(2);
    expect(saveData).not.toHaveBeenCalled();
  });

  it("does nothing when the file is already first", () => {
    const { store, saveRecents } = makeStore({ recents: ["a.md"] });
    store.recordOpen("a.md");
    expect(saveRecents).not.toHaveBeenCalled();
  });

  it("trims to the new limit when maxItems drops", () => {
    const { store } = makeStore({ data: { settings: { maxItems: 10 } }, recents: ["a", "b", "c", "d", "e", "f"] });
    store.updateSettings({ maxItems: 3 });
    expect(store.recents).toEqual(["a", "b", "c"]);
  });

  it("prunes with a predicate", () => {
    const { store } = makeStore({ recents: ["a.md", "b.png", "c.md"] });
    store.pruneRecents((p) => p.endsWith(".md"));
    expect(store.recents).toEqual(["a.md", "c.md"]);
  });
});

describe("rename and remove", () => {
  it("follows a folder rename in both lists and notifies once", () => {
    const { store } = makeStore({ data: { pins: ["notes/a.md"] }, recents: ["notes/b.md", "other.md"] });
    const listener = vi.fn();
    store.onChange(listener);
    store.rename("notes", "docs");
    expect(store.pins).toEqual(["docs/a.md"]);
    expect(store.recents).toEqual(["docs/b.md", "other.md"]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("removes a deleted file from pins and recents", () => {
    const { store } = makeStore({ data: { pins: ["a.md"] }, recents: ["a.md", "b.md"] });
    store.remove("a.md");
    expect(store.pins).toEqual([]);
    expect(store.recents).toEqual(["b.md"]);
  });

  it("stays quiet when the path is not tracked", () => {
    const { store, saveData, saveRecents } = makeStore({ recents: ["a.md"] });
    const listener = vi.fn();
    store.onChange(listener);
    store.rename("x.md", "y.md");
    store.remove("z.md");
    expect(listener).not.toHaveBeenCalled();
    expect(saveData).not.toHaveBeenCalled();
    expect(saveRecents).not.toHaveBeenCalled();
  });
});

describe("settings and omit rules", () => {
  it("compiles path patterns and reports invalid ones", () => {
    const { store } = makeStore();
    store.updateSettings({ omittedPaths: ["^daily/", "(bad"] });
    expect(store.pathOmitted("daily/x.md")).toBe(true);
    expect(store.pathOmitted("notes/x.md")).toBe(false);
    expect(store.invalidPathPatterns).toEqual(["(bad"]);
  });

  it("picks up data.json changes from outside and ignores bad data", () => {
    const { store } = makeStore({ data: { pins: ["a"] }, recents: ["r1", "r2", "r3"] });
    store.reloadData({ settings: { maxItems: 2 }, pins: ["z"] });
    expect(store.pins).toEqual(["z"]);
    expect(store.recents).toEqual(["r1", "r2"]);
    store.reloadData("garbage");
    expect(store.pins).toEqual([]);
  });

  it("stops notifying after unsubscribe", () => {
    const { store } = makeStore();
    const listener = vi.fn();
    const off = store.onChange(listener);
    store.pin("a");
    off();
    store.pin("b");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
