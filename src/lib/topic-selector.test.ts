import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "./settings";
import {
  manualChoice,
  nextBasicQuestion,
  previousQuestionsForTopic,
  rankTopics,
  selectTopic,
  type TopicSelectionInput,
} from "./topic-selector";
import { BASIC_FOLLOW_UPS, TOPICS, getTopic, levelRank } from "./topics";
import type { MistakeRecord, SessionRecord, TranscriptTurn } from "./types";

const NOW = 100 * 86_400_000;

function input(over: Partial<TopicSelectionInput> = {}): TopicSelectionInput {
  return {
    settings: { level: "intermediate", interests: [], goal: "" },
    sessions: [],
    mistakes: [],
    now: NOW,
    ...over,
  };
}

const mistake = (category: MistakeRecord["category"], count: number): MistakeRecord => ({
  key: category, category, label: category, examples: [], occurrenceCount: count, sessionIds: ["s"],
  firstSeenAt: NOW - 1000, lastSeenAt: NOW - 1000, lastPracticedAt: null, correctUses: [], status: "active",
});

describe("rankTopics / selectTopic", () => {
  it("never offers topics above the learner's level", () => {
    const ranked = rankTopics(input({ settings: { level: "beginner", interests: [], goal: "" } }));
    expect(ranked.length).toBeGreaterThan(5);
    expect(ranked.every((c) => levelRank(c.topic.minLevel) === 0)).toBe(true);
  });

  it("prefers topics matching interests and goal", () => {
    const top = rankTopics(input({ settings: { level: "advanced", interests: ["interviews"], goal: "crack my job interview" } }))[0];
    expect(top.topic.category).toBe("interviews");
    expect(top.reason).toMatch(/interest/);
  });

  it("targets recurring mistakes and explains why", () => {
    const top = rankTopics(input({ mistakes: [mistake("present-perfect", 6)] }))[0];
    expect(top.topic.practises).toContain("present-perfect");
    expect(top.focusCategories).toEqual(["present-perfect"]);
    expect(top.reason).toMatch(/present perfect/i);
  });

  it("avoids the topics of the last two sessions", () => {
    const first = rankTopics(input())[0].topic;
    const sessions = [{ topicId: first.id, topicCategory: first.category, startedAt: NOW - 1000 }];
    const again = rankTopics(input({ sessions }));
    expect(again[0].topic.id).not.toBe(first.id);
    expect(again.find((c) => c.topic.id === first.id)!.score).toBeLessThan(again[0].score - 4);
  });

  it("is deterministic with an injected random source and respects exclusions", () => {
    const a = selectTopic(input(), () => 0);
    const b = selectTopic(input(), () => 0);
    expect(a.topic.id).toBe(b.topic.id);
    const c = selectTopic(input(), () => 0, [a.topic.id]);
    expect(c.topic.id).not.toBe(a.topic.id);
  });

  it("varies across the top choices", () => {
    const ids = new Set([0, 0.5, 0.99].map((r) => selectTopic(input(), () => r).topic.id));
    expect(ids.size).toBeGreaterThan(1);
  });

  it("supports a manual pick", () => {
    const t = getTopic("interview-introduce")!;
    expect(manualChoice(t, input())).toMatchObject({ topic: t, reason: "You picked this topic yourself." });
  });

  it("all topics have questions and vocabulary for Basic mode", () => {
    for (const t of TOPICS) {
      expect(t.questions.length, t.id).toBeGreaterThanOrEqual(4);
      expect(t.vocabulary.length, t.id).toBeGreaterThanOrEqual(4);
      expect(t.questions.every((q) => q.endsWith("?") || q.endsWith(".")), t.id).toBe(true);
    }
    expect(new Set(TOPICS.map((t) => t.id)).size).toBe(TOPICS.length);
  });
});

describe("question repetition", () => {
  const topic = getTopic("daily-routine")!;
  const coach = (text: string): TranscriptTurn => ({ id: text, role: "coach", text, at: 0, source: "basic" });
  const learner = (text: string): TranscriptTurn => ({ id: text, role: "learner", text, at: 0, source: "typed" });

  it("never repeats a question within a session", () => {
    const turns: TranscriptTurn[] = [];
    const asked: string[] = [];
    for (let i = 0; i < 20; i += 1) {
      const next = nextBasicQuestion(topic, turns);
      if (!next) break;
      asked.push(next.text);
      turns.push(coach(next.text), learner("I wake up at seven and then I go to the office by metro every day."));
    }
    expect(new Set(asked).size).toBe(asked.length);
    expect(asked.length).toBe(topic.questions.length);
    expect(nextBasicQuestion(topic, turns)).toBeNull();
  });

  it("does not repeat a scripted prompt that ends with a full stop (seen in a real Basic-mode run)", () => {
    const t = getTopic("work-email-call")!;
    const opening = coach(`Hi! Let's talk about handling a difficult work situation. ${t.questions[0]}`);
    const next = nextBasicQuestion(t, [opening, learner("Last year our server went down on a Friday night and we fixed it together.")]);
    expect(next?.text).not.toBe(t.questions[0]);
    expect(next?.text).toBe(t.questions[1]);
  });

  it("asks for more detail after a very short answer", () => {
    const next = nextBasicQuestion(topic, [coach(topic.questions[0]), learner("Office.")]);
    expect(next?.kind).toBe("follow-up");
    expect(BASIC_FOLLOW_UPS).toContain(next?.text);
  });

  it("prefers questions not asked in earlier sessions", () => {
    const next = nextBasicQuestion(topic, [], [topic.questions[0], topic.questions[1]]);
    expect(next?.text).toBe(topic.questions[2]);
  });

  it("collects previous questions for the same topic only", () => {
    const sessions = [
      { topicId: "daily-routine", startedAt: 2, turns: [coach("Nice! What time do you wake up?"), coach("Do you cook?")] },
      { topicId: "daily-food", startedAt: 3, turns: [coach("What is your favourite dish?")] },
    ] as Pick<SessionRecord, "topicId" | "turns" | "startedAt">[];
    expect(previousQuestionsForTopic(sessions, "daily-routine")).toEqual(["What time do you wake up?", "Do you cook?"]);
  });
});

describe("defaults", () => {
  it("default settings produce a sensible first topic", () => {
    const c = selectTopic(input({ settings: DEFAULT_SETTINGS }), () => 0);
    expect(DEFAULT_SETTINGS.interests).toContain(c.topic.category);
  });
});
