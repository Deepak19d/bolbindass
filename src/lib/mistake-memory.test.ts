import { describe, expect, it } from "vitest";
import { ruleHitsToCorrections } from "./corrections";
import { checkGrammar } from "./grammar-rules";
import {
  MEMORY_RULES,
  computeStatus,
  deriveOutcome,
  rebuildMemory,
  recurringCategories,
  topWeaknesses,
  updateMistakeMemory,
  type PracticeSessionRef,
} from "./mistake-memory";
import type { MistakeRecord, SessionRecord, TranscriptTurn } from "./types";

const DAY = 86_400_000;
let n = 0;
const id = () => `x${++n}`;

function learnerTurn(text: string, at: number): TranscriptTurn {
  const turnId = id();
  return {
    id: turnId, role: "learner", text, at, source: "typed",
    corrections: ruleHitsToCorrections(checkGrammar(text), turnId, id), analysis: "done",
  };
}

function session(sid: string, day: number, answers: string[]): SessionRecord {
  const start = day * DAY;
  return {
    id: sid, startedAt: start, endedAt: start + 600_000, durationSec: 600,
    topicId: "daily-last-weekend", topicTitle: "t", topicCategory: "daily-life", topicReason: "",
    focusCategories: ["past-tense"], mode: "friendly", engine: "basic", model: null, level: "intermediate",
    turns: answers.map((a, i) => learnerTurn(a, start + (i + 1) * 1000)), report: null,
  };
}

const WRONG = "Yesterday I go to the market.";
const RIGHT = "Yesterday I went to the market.";
const RIGHT2 = "Last week we visited Agra.";
const NEUTRAL = "I like my job very much.";

describe("updateMistakeMemory", () => {
  it("records category, original, corrected, explanation, count and dates", () => {
    const s = session("s1", 1, [WRONG, "Last week I eat biryani.", NEUTRAL]);
    const mem = updateMistakeMemory([], deriveOutcome(s), [{ id: "s1", at: s.endedAt! }]);
    expect(mem).toHaveLength(1);
    const rec = mem[0];
    expect(rec).toMatchObject({
      key: "past-tense", category: "past-tense", label: "Past tense",
      occurrenceCount: 2, sessionIds: ["s1"], status: "active", lastPracticedAt: s.endedAt,
    });
    expect(rec.examples[0]).toMatchObject({
      original: WRONG, corrected: "Yesterday I went to the market.", sessionId: "s1", source: "rule",
    });
    expect(rec.examples[0].explanation).toMatch(/past tense/i);
  });

  it("tracks the user's three example patterns as separate categories", () => {
    const s = session("s1", 1, [
      "I go yesterday.", "I am working here since two years.", "I discussed about the project.",
    ]);
    const mem = updateMistakeMemory([], deriveOutcome(s), [{ id: "s1", at: s.endedAt! }]);
    expect(mem.map((m) => m.category).sort()).toEqual(["past-tense", "present-perfect", "redundant-words"]);
  });

  it("does NOT mark a mistake resolved after one correct answer", () => {
    const s1 = session("s1", 1, [WRONG, NEUTRAL, NEUTRAL]);
    const s2 = session("s2", 2, [RIGHT, NEUTRAL, NEUTRAL]);
    const practice: PracticeSessionRef[] = [{ id: "s1", at: s1.endedAt! }];
    let mem = updateMistakeMemory([], deriveOutcome(s1), practice);
    practice.push({ id: "s2", at: s2.endedAt! });
    mem = updateMistakeMemory(mem, deriveOutcome(s2), practice);
    expect(mem[0].correctUses).toHaveLength(1);
    expect(mem[0].status).toBe("improving");
    expect(mem[0].status).not.toBe("resolved");
  });

  it("resolves only after repeated correct use across sessions with clean sessions", () => {
    const sessions = [
      session("s1", 1, [WRONG, NEUTRAL, NEUTRAL]),
      session("s2", 2, [RIGHT, RIGHT2, NEUTRAL]),
      session("s3", 3, ["Yesterday I called my mother.", NEUTRAL, NEUTRAL]),
    ];
    const statuses: string[] = [];
    let mem: MistakeRecord[] = [];
    const practice: PracticeSessionRef[] = [];
    for (const s of sessions) {
      practice.push({ id: s.id, at: s.endedAt! });
      mem = updateMistakeMemory(mem, deriveOutcome(s), practice);
      statuses.push(mem[0].status);
    }
    expect(statuses).toEqual(["active", "improving", "resolved"]);
    expect(mem[0].correctUses.length).toBeGreaterThanOrEqual(MEMORY_RULES.resolveEvidence);
  });

  it("re-opens a resolved mistake when it comes back", () => {
    const sessions = [
      session("s1", 1, [WRONG, NEUTRAL, NEUTRAL]),
      session("s2", 2, [RIGHT, RIGHT2, NEUTRAL]),
      session("s3", 3, ["Yesterday I called my mother.", NEUTRAL, NEUTRAL]),
      session("s4", 4, ["Last week I eat pizza.", NEUTRAL, NEUTRAL]),
    ];
    const mem = rebuildMemory(sessions);
    expect(mem[0].status).toBe("active");
    expect(mem[0].occurrenceCount).toBe(2);
    expect(mem[0].sessionIds).toEqual(["s1", "s4"]);
  });

  it("resolves by long absence only after many practice sessions", () => {
    const rec: MistakeRecord = {
      key: "articles", category: "articles", label: "Articles", examples: [], occurrenceCount: 3,
      sessionIds: ["a"], firstSeenAt: 0, lastSeenAt: 10, lastPracticedAt: null, correctUses: [], status: "active",
    };
    const later = (k: number) => Array.from({ length: k }, (_, i) => ({ id: `p${i}`, at: 100 + i }));
    expect(computeStatus(rec, later(2))).toBe("active");
    expect(computeStatus(rec, later(MEMORY_RULES.improvingAbsenceSessions))).toBe("improving");
    expect(computeStatus(rec, later(MEMORY_RULES.resolveByAbsenceSessions))).toBe("resolved");
  });

  it("ignores evidence for categories that were never a problem", () => {
    const s = session("s1", 1, [RIGHT, NEUTRAL, NEUTRAL]);
    expect(updateMistakeMemory([], deriveOutcome(s), [{ id: "s1", at: s.endedAt! }])).toEqual([]);
  });
});

describe("weakness helpers", () => {
  it("returns recurring categories and top weaknesses", () => {
    const mem = rebuildMemory([
      session("s1", 1, [WRONG, "I discussed about it.", NEUTRAL]),
      session("s2", 2, ["Last week I eat pizza.", NEUTRAL, NEUTRAL]),
    ]);
    expect([...recurringCategories(mem)]).toEqual(["past-tense"]);
    expect(topWeaknesses(mem, 3 * DAY, 1)[0].category).toBe("past-tense");
  });
});
