import { categoryLabel } from "./categories";
import { topWeaknesses, weaknessWeight } from "./mistake-memory";
import { containsNormalized, normalizeText, splitSentences, wordCount } from "./text";
import {
  BASIC_FOLLOW_UPS,
  TOPIC_CATEGORY_LABELS,
  TOPICS,
  levelRank,
  type Topic,
} from "./topics";
import type {
  MistakeCategory,
  MistakeRecord,
  SessionRecord,
  Settings,
  TopicCategory,
  TranscriptTurn,
} from "./types";

export interface TopicChoice {
  topic: Topic;
  score: number;
  reason: string;
  focusCategories: MistakeCategory[];
}

export interface TopicSelectionInput {
  settings: Pick<Settings, "level" | "interests" | "goal">;
  sessions: Pick<SessionRecord, "topicId" | "topicCategory" | "startedAt">[];
  mistakes: MistakeRecord[];
  now: number;
}

const GOAL_KEYWORDS: [RegExp, TopicCategory[]][] = [
  [/\b(interview|job|hr|placement|hiring|offer)\b/i, ["interviews"]],
  [/\b(manager|boss|team|office|colleague|meeting|workplace|standup|stand-up)\b/i, ["workplace", "manager-colleagues"]],
  [/\b(project|portfolio|demo|client|product)\b/i, ["projects"]],
  [/\b(ai|software|developer|coding|code|tech|programming|engineer)\b/i, ["ai-software"]],
  [/\b(daily|friends|travel|confidence|casual|small talk)\b/i, ["daily-life", "opinions-stories"]],
];

function goalCategories(goal: string): Set<TopicCategory> {
  const out = new Set<TopicCategory>();
  for (const [re, cats] of GOAL_KEYWORDS) if (re.test(goal)) cats.forEach((c) => out.add(c));
  return out;
}

export function rankTopics(input: TopicSelectionInput): TopicChoice[] {
  const { settings, mistakes, now } = input;
  const sessions = [...input.sessions].sort((a, b) => b.startedAt - a.startedAt);
  const userLevel = levelRank(settings.level);
  const goals = goalCategories(settings.goal);
  const weak = topWeaknesses(mistakes, now, 3);
  const maxWeight = Math.max(0, ...weak.map((w) => weaknessWeight(w, now)));
  const lastCategory = sessions[0]?.topicCategory;

  const choices: TopicChoice[] = [];
  for (const topic of TOPICS) {
    const topicLevel = levelRank(topic.minLevel);
    if (topicLevel > userLevel) continue;

    let score = 1;
    const reasons: string[] = [];

    const focus = weak
      .filter((w) => topic.practises.includes(w.category))
      .map((w) => w.category);
    if (focus.length > 0 && maxWeight > 0) {
      for (const w of weak) {
        if (topic.practises.includes(w.category)) score += 3 * (weaknessWeight(w, now) / maxWeight);
      }
      reasons.push(
        `it makes you practise ${focus.map((c) => categoryLabel(c).toLowerCase()).join(" and ")}, which keeps coming up in your answers`,
      );
    }

    if (settings.interests.includes(topic.category)) {
      score += 2;
      reasons.push(`it matches your interest in ${TOPIC_CATEGORY_LABELS[topic.category].toLowerCase()}`);
    }
    if (goals.has(topic.category)) {
      score += 1.5;
      reasons.push("it fits your goal");
    }
    if (userLevel >= 3 && topicLevel === 0) score -= 0.5;

    const uses = sessions.filter((s) => s.topicId === topic.id);
    const recentIndex = sessions.findIndex((s) => s.topicId === topic.id);
    if (recentIndex !== -1 && recentIndex < 2) score -= 6;
    else if (recentIndex !== -1 && recentIndex < 5) score -= 2.5;
    score -= Math.min(2, uses.length * 0.3);
    if (lastCategory && lastCategory === topic.category) score -= 1;
    if (uses.length === 0) reasons.push("you haven't practised it yet");

    const reason =
      reasons.length > 0
        ? `Chosen because ${reasons.slice(0, 2).join(", and ")}.`
        : "A fresh topic to keep your practice varied.";
    choices.push({ topic, score, reason, focusCategories: focus });
  }
  return choices.sort((a, b) => b.score - a.score);
}

/**
 * Pick a topic automatically. Uses weighted randomness among the best three
 * so the learner doesn't get the same topic every time.
 */
export function selectTopic(
  input: TopicSelectionInput,
  rng: () => number = Math.random,
  excludeIds: string[] = [],
): TopicChoice {
  const ranked = rankTopics(input).filter((c) => !excludeIds.includes(c.topic.id));
  const pool = (ranked.length > 0 ? ranked : rankTopics(input)).slice(0, 3);
  if (pool.length === 0) {
    // Should never happen: beginner topics exist for every level.
    const topic = TOPICS[0];
    return { topic, score: 0, reason: "A fresh topic to keep your practice varied.", focusCategories: [] };
  }
  const min = Math.min(...pool.map((c) => c.score));
  const weights = pool.map((c) => c.score - min + 0.5);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < pool.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

/** Choice for a learner-picked topic (manual override). */
export function manualChoice(topic: Topic, input: TopicSelectionInput): TopicChoice {
  const ranked = rankTopics(input).find((c) => c.topic.id === topic.id);
  return {
    topic,
    score: ranked?.score ?? 0,
    reason: "You picked this topic yourself.",
    focusCategories: ranked?.focusCategories ?? [],
  };
}

// ── Avoiding repeated questions ──────────────────────────────────────────

export function questionsIn(turns: TranscriptTurn[]): string[] {
  const out: string[] = [];
  for (const t of turns) {
    if (t.role !== "coach") continue;
    for (const s of splitSentences(t.text)) if (s.trim().endsWith("?")) out.push(s.trim());
  }
  return out;
}

/** Questions the coach already asked about this topic in earlier sessions. */
export function previousQuestionsForTopic(
  sessions: Pick<SessionRecord, "topicId" | "turns" | "startedAt">[],
  topicId: string,
  limit = 8,
): string[] {
  const out: string[] = [];
  const ordered = [...sessions].sort((a, b) => b.startedAt - a.startedAt);
  for (const s of ordered) {
    if (s.topicId !== topicId) continue;
    for (const q of questionsIn(s.turns)) {
      if (!out.some((o) => normalizeText(o) === normalizeText(q))) out.push(q);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/**
 * Basic practice mode (no AI): pick the next scripted question. It never
 * repeats a question within the session and prefers questions not asked in
 * earlier sessions. Returns null when the topic is exhausted.
 */
export function nextBasicQuestion(
  topic: Topic,
  turns: TranscriptTurn[],
  askedBefore: string[] = [],
): { text: string; kind: "topic" | "follow-up" } | null {
  const coachText = turns.filter((t) => t.role === "coach").map((t) => t.text).join("\n");
  const askedNow = new Set(questionsIn(turns).map(normalizeText));
  // Scripted prompts like "Tell me about…" end with "." — match them by content too.
  for (const q of [...topic.questions, ...BASIC_FOLLOW_UPS]) {
    if (containsNormalized(coachText, q)) askedNow.add(normalizeText(q));
  }
  const before = new Set(askedBefore.map(normalizeText));
  const lastLearner = [...turns].reverse().find((t) => t.role === "learner");
  const lastCoach = [...turns].reverse().find((t) => t.role === "coach");
  const lastWasFollowUp = lastCoach
    ? BASIC_FOLLOW_UPS.some((f) => normalizeText(f) === normalizeText(lastCoach.text))
    : false;

  // Short answer → nudge for more before moving on.
  if (lastLearner && wordCount(lastLearner.text) < 8 && !lastWasFollowUp) {
    const followUp = BASIC_FOLLOW_UPS.find((f) => !askedNow.has(normalizeText(f)));
    if (followUp) return { text: followUp, kind: "follow-up" };
  }

  const unused = topic.questions.filter((q) => !askedNow.has(normalizeText(q)));
  const fresh = unused.find((q) => !before.has(normalizeText(q)));
  const pick = fresh ?? unused[0];
  return pick ? { text: pick, kind: "topic" } : null;
}
