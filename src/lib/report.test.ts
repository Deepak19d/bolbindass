import { describe, expect, it } from "vitest";
import { ruleHitsToCorrections } from "./corrections";
import { checkGrammar } from "./grammar-rules";
import { buildReport, computeStats, formatClock, formatDuration } from "./report";
import { getTopic } from "./topics";
import type { MistakeRecord, SessionRecord, TranscriptTurn } from "./types";

let n = 0;
const id = () => `r${++n}`;
const coach = (text: string): TranscriptTurn => ({ id: id(), role: "coach", text, at: 0, source: "ai" });
function learner(text: string, source: TranscriptTurn["source"] = "voice"): TranscriptTurn {
  const tid = id();
  return { id: tid, role: "learner", text, at: 1, source, corrections: ruleHitsToCorrections(checkGrammar(text), tid, id), analysis: "done" };
}

function makeSession(over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "s1", startedAt: 0, endedAt: 420_000, durationSec: 420, topicId: "daily-last-weekend",
    topicTitle: "What you did last weekend", topicCategory: "daily-life", topicReason: "",
    focusCategories: [], mode: "friendly", engine: "ollama", model: "llama3.2:3b", level: "intermediate",
    turns: [
      coach("Hi! What did you do last weekend?"),
      learner("Last weekend I go to Lonavala with my friends um um and it was really fun."),
      coach("Nice! What did you do there?"),
      learner("We walked in the hills and we ate vada pav."),
      coach("Sounds great. Did anything go wrong?"),
      learner("I I discussed about the plan with my friend but it rained."),
    ],
    report: null,
    ...over,
  };
}

describe("computeStats", () => {
  it("counts learner turns, words, fillers and repeats from the transcript", () => {
    const st = computeStats(makeSession().turns);
    expect(st).toMatchObject({ learnerTurns: 3, coachTurns: 3, fillerCount: 2, repeatedWordCount: 2 });
    expect(st.totalWords).toBe(16 + 10 + 12);
    expect(st.longestTurnWords).toBe(16);
  });
});

describe("buildReport", () => {
  const memory: MistakeRecord[] = [
    { key: "past-tense", category: "past-tense", label: "Past tense", examples: [], occurrenceCount: 4, sessionIds: ["a", "s1"], firstSeenAt: 0, lastSeenAt: 1, lastPracticedAt: null, correctUses: [], status: "active" },
  ];

  it("contains topic, duration, turns, corrections, recurring mistakes, goal and next topic", () => {
    const next = { topic: getTopic("daily-routine")!, score: 1, reason: "Because.", focusCategories: [] };
    const r = buildReport({ session: makeSession(), memory, nextTopic: next, aiExtras: null, now: 9 });
    expect(r.topicTitle).toBe("What you did last weekend");
    expect(r.durationSec).toBe(420);
    expect(r.stats.learnerTurns).toBe(3);
    expect(r.corrections.map((c) => c.category)).toEqual(["past-tense", "redundant-words"]);
    expect(r.recurring).toEqual([{ category: "past-tense", label: "Past tense", countThisSession: 1, totalCount: 4 }]);
    expect(r.improvementGoal).toMatch(/past/);
    expect(r.nextTopic).toEqual({ id: "daily-routine", title: getTopic("daily-routine")!.title, reason: "Because." });
    expect(r.betterExpressions).toContainEqual({ learnerSaid: "I I discussed about the plan with my friend but it rained.", natural: expect.stringContaining("talked about") });
  });

  it("only uses sentences the learner actually said", () => {
    const session = makeSession();
    const r = buildReport({
      session, memory: [], nextTopic: null, now: 9,
      aiExtras: {
        strengths: [
          { point: "Good storytelling", evidence: "We walked in the hills and we ate vada pav." },
          { point: "Invented", evidence: "I gave a brilliant presentation to the CEO." },
        ],
        betterExpressions: [
          { learnerSaid: "We walked in the hills", natural: "We went hiking in the hills and had vada pav." },
          { learnerSaid: "I flew to Paris.", natural: "I travelled to Paris." },
          { learnerSaid: "We walked in the hills and we ate vada pav.", natural: "We walked in the hills and we ate vada pav. It was a great experience." },
        ],
        vocabulary: [{ word: "go hiking", meaning: "walk in nature for fun", example: "We went hiking." }, { word: "" }],
      },
    });
    const evidence = r.strengths.map((s) => s.evidence).filter(Boolean);
    expect(evidence).toContain("We walked in the hills and we ate vada pav.");
    expect(evidence.join(" ")).not.toContain("CEO");
    expect(r.betterExpressions.map((e) => e.learnerSaid)).not.toContain("I flew to Paris.");
    expect(r.betterExpressions.some((e) => e.natural.includes("great experience"))).toBe(false);
    expect(r.vocabulary).toEqual([{ word: "go hiking", meaning: "walk in nature for fun", example: "We went hiking." }]);
    expect(r.vocabularySource).toBe("ai");
    expect(r.aiSummaryUsed).toBe(true);
  });

  it("never claims pronunciation accuracy and labels Basic mode honestly", () => {
    const r = buildReport({ session: makeSession({ engine: "basic", model: null }), memory: [], nextTopic: null, now: 1 });
    const text = JSON.stringify(r).toLowerCase();
    expect(r.notes[0]).toMatch(/Pronunciation is not measured/);
    expect(text).not.toMatch(/pronunciation (score|accuracy|was|is good)/);
    expect(r.notes.join(" ")).toMatch(/Basic practice mode/);
    expect(r.vocabularySource).toBe("topic-list");
    expect(r.aiSummaryUsed).toBe(false);
  });

  it("never quotes a sentence with a detected mistake as a strength", () => {
    const s = makeSession({
      turns: [
        coach("Why this company?"),
        learner("I am working as software engineer since two years in a small startup.", "typed"),
        learner("I have good knowledge of React and Node, and I can learn new things quickly.", "typed"),
        learner("Last month I build a chatbot for our customers.", "typed"),
      ],
    });
    const r = buildReport({
      session: s, memory: [], nextTopic: null, now: 1,
      aiExtras: { strengths: [{ point: "specific example of achievement", evidence: "Last month I build a chatbot for our customers." }, { point: "ok", evidence: "I have good knowledge of React and Node, and I can learn new things quickly." }] },
    });
    const quoted = r.strengths.map((x) => x.evidence).filter(Boolean);
    expect(quoted).not.toContain("I am working as software engineer since two years in a small startup.");
    expect(quoted).not.toContain("Last month I build a chatbot for our customers.");
    // "software engineer" must not count as an uncountable-noun use; "good knowledge" does.
    for (const st of r.strengths.filter((x) => /uncountable/.test(x.point))) expect(st.evidence).toMatch(/knowledge/);
    expect(r.strengths.some((x) => x.point === "Ok")).toBe(false); // too vague
  });

  it("handles a session without mistakes", () => {
    const s = makeSession({ turns: [coach("Hi?"), learner("I went to the market yesterday and bought some fresh vegetables for dinner.", "typed")] });
    const r = buildReport({ session: s, memory: [], nextTopic: null, now: 1 });
    expect(r.corrections).toEqual([]);
    expect(r.improvementGoal).toMatch(/harder topic|Immersion|longer/);
  });
});

describe("formatting", () => {
  it("formats durations", () => {
    expect(formatDuration(65)).toBe("1 min 05 s");
    expect(formatDuration(9)).toBe("9 s");
    expect(formatClock(605)).toBe("10:05");
  });
});
