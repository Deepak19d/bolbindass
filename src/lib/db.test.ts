import { beforeEach, describe, expect, it } from "vitest";
import { ruleHitsToCorrections } from "./corrections";
import {
  DB_NAME,
  deleteAllHistory,
  deleteSession,
  exportAll,
  exportFileName,
  getSession,
  listMistakes,
  listSessions,
  replaceMistakes,
  resetDbConnection,
  saveSession,
} from "./db";
import { finalizeSession } from "./finalize";
import { checkGrammar } from "./grammar-rules";
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, loadSettings, saveSettings } from "./settings";
import type { SessionRecord, TranscriptTurn } from "./types";

let n = 0;
const id = () => `d${++n}`;
function learner(text: string, at: number): TranscriptTurn {
  const tid = id();
  return { id: tid, role: "learner", text, at, source: "typed", corrections: ruleHitsToCorrections(checkGrammar(text), tid, id), analysis: "done" };
}
function session(sid: string, startedAt: number, answers: string[], endedAt: number | null = startedAt + 60_000): SessionRecord {
  return {
    id: sid, startedAt, endedAt, durationSec: 60, topicId: "daily-routine", topicTitle: "Routine",
    topicCategory: "daily-life", topicReason: "", focusCategories: [], mode: "friendly", engine: "basic",
    model: null, level: "intermediate", report: null,
    turns: [{ id: id(), role: "coach", text: "Hi?", at: startedAt, source: "basic" }, ...answers.map((a, i) => learner(a, startedAt + i + 1))],
  };
}

const store = { listSessions, listMistakes, replaceMistakes, saveSession };

beforeEach(async () => {
  await resetDbConnection();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
});

describe("local history persistence", () => {
  it("saves, reads and lists sessions newest first", async () => {
    await saveSession(session("a", 1000, ["Hello"]));
    await saveSession(session("b", 5000, ["Hi"]));
    expect((await listSessions()).map((s) => s.id)).toEqual(["b", "a"]);
    expect((await getSession("a"))?.turns[1].text).toBe("Hello");
    // Survives a new connection (like a page reload).
    await resetDbConnection();
    expect(await getSession("b")).toBeDefined();
  });

  it("finalizing a session saves the report and mistake memory", async () => {
    const s = session("a", 1000, ["Yesterday I go to the office.", "I am working here since two years.", "Fine."], null);
    const final = await finalizeSession(s, false, { settings: DEFAULT_SETTINGS, now: 99_999, store, rng: () => 0 });
    expect(final.endedAt).toBe(1003); // closed tab → last turn time
    expect(final.report?.corrections).toHaveLength(2);
    expect(final.report?.nextTopic).not.toBeNull();
    expect((await getSession("a"))?.report).not.toBeNull();
    expect((await listMistakes()).map((m) => m.category).sort()).toEqual(["past-tense", "present-perfect"]);
  });

  it("deleting a session rebuilds mistake memory without it", async () => {
    await finalizeSession(session("a", 1000, ["Yesterday I go there.", "x", "y"], null), false, { settings: DEFAULT_SETTINGS, now: 1, store });
    await finalizeSession(session("b", 9000, ["I discussed about it.", "x", "y"], null), false, { settings: DEFAULT_SETTINGS, now: 2, store });
    expect((await listMistakes()).length).toBe(2);
    await deleteSession("a");
    expect((await listSessions()).map((s) => s.id)).toEqual(["b"]);
    expect((await listMistakes()).map((m) => m.category)).toEqual(["redundant-words"]);
  });
});

describe("export and deletion", () => {
  it("exports settings, sessions and mistakes as JSON without audio", async () => {
    saveSettings({ ...DEFAULT_SETTINGS, name: "Deepak" });
    await finalizeSession(session("a", 1000, ["Yesterday I go there.", "x", "y"], null), false, { settings: DEFAULT_SETTINGS, now: 1, store });
    const bundle = await exportAll(new Date("2026-10-13T10:00:00Z"));
    expect(bundle).toMatchObject({ app: "bolbindass", formatVersion: 1, exportedAt: "2026-10-13T10:00:00.000Z" });
    expect(bundle.settings.name).toBe("Deepak");
    expect(bundle.sessions).toHaveLength(1);
    expect(bundle.mistakes).toHaveLength(1);
    expect(JSON.stringify(bundle)).not.toMatch(/audio|blob:|data:audio/i);
    expect(exportFileName(new Date("2026-10-13T10:00:00Z"))).toBe("bolbindass-history-2026-10-13.json");
  });

  it("deletes all history but keeps settings unless asked", async () => {
    saveSettings({ ...DEFAULT_SETTINGS, name: "Deepak" });
    await finalizeSession(session("a", 1000, ["Yesterday I go there.", "x", "y"], null), false, { settings: DEFAULT_SETTINGS, now: 1, store });
    await deleteAllHistory();
    expect(await listSessions()).toEqual([]);
    expect(await listMistakes()).toEqual([]);
    expect(loadSettings().name).toBe("Deepak");
    await deleteAllHistory({ includeSettings: true });
    expect(window.localStorage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });
});
