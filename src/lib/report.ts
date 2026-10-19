import { MISTAKE_CATEGORIES, categoryLabel } from "./categories";
import { rankCorrections } from "./corrections";
import { detectCorrectUsage } from "./grammar-rules";
import { countFillers, countRepeatedWords, findSourceSentence, normalizeText, truncate, wordSimilarity, words } from "./text";
import type { TopicChoice } from "./topic-selector";
import { getTopic } from "./topics";
import type {
  BetterExpression,
  Correction,
  MistakeCategory,
  MistakeRecord,
  SessionRecord,
  SessionReport,
  SessionStats,
  Strength,
  TranscriptTurn,
  VocabularyItem,
} from "./types";

/** Optional extras from the local model; everything is validated before use. */
export interface AiReportExtras {
  strengths?: unknown;
  vocabulary?: unknown;
  betterExpressions?: unknown;
}

export function learnerTurns(turns: TranscriptTurn[]): TranscriptTurn[] {
  return turns.filter((t) => t.role === "learner");
}

export function computeStats(turns: TranscriptTurn[]): SessionStats {
  const learner = learnerTurns(turns);
  const counts = learner.map((t) => words(t.text).length);
  const totalWords = counts.reduce((a, b) => a + b, 0);
  const unique = new Set(learner.flatMap((t) => words(t.text)));
  return {
    learnerTurns: learner.length,
    coachTurns: turns.filter((t) => t.role === "coach" && !t.helper).length,
    totalWords,
    avgWordsPerTurn: learner.length ? Math.round((totalWords / learner.length) * 10) / 10 : 0,
    longestTurnWords: counts.length ? Math.max(...counts) : 0,
    uniqueWords: unique.size,
    fillerCount: learner.reduce((n, t) => n + countFillers(t.text), 0),
    repeatedWordCount: learner.reduce((n, t) => n + countRepeatedWords(t.text), 0),
  };
}

export function allCorrections(turns: TranscriptTurn[]): Correction[] {
  return learnerTurns(turns).flatMap((t) => t.corrections ?? []);
}

const str = (v: unknown, max: number) => (typeof v === "string" ? truncate(v.trim(), max) : "");

function validStrengths(raw: unknown, learnerText: string, flawed: Set<string>): Strength[] {
  if (!Array.isArray(raw)) return [];
  const out: Strength[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const point = str((item as Record<string, unknown>).point, 160);
    const quoted = str((item as Record<string, unknown>).evidence, 300);
    if (words(point).length < 2 || !quoted) continue;
    // A strength must be backed by words the learner actually said, in a
    // sentence that has no detected mistakes.
    const source = findSourceSentence(learnerText, quoted);
    if (!source || flawed.has(normalizeText(source))) continue;
    out.push({ point: point.charAt(0).toUpperCase() + point.slice(1), evidence: source });
  }
  return out;
}

function validVocabulary(raw: unknown): VocabularyItem[] {
  if (!Array.isArray(raw)) return [];
  const out: VocabularyItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const word = str(r.word, 40);
    const meaning = str(r.meaning, 160);
    if (!word || !meaning) continue;
    if (out.some((v) => normalizeText(v.word) === normalizeText(word))) continue;
    out.push({ word, meaning, example: str(r.example, 200) || undefined });
  }
  return out.slice(0, 6);
}

function validExpressions(raw: unknown, learnerText: string): BetterExpression[] {
  if (!Array.isArray(raw)) return [];
  const out: BetterExpression[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const said = str(r.learnerSaid, 300);
    const natural = str(r.natural, 300);
    if (!said || !natural) continue;
    const source = findSourceSentence(learnerText, said);
    if (!source || normalizeText(source) === normalizeText(natural)) continue;
    // Must be a rephrasing — not the same sentence with new content appended.
    if (normalizeText(natural).includes(normalizeText(source)) || wordSimilarity(source, natural) < 0.3) continue;
    out.push({ learnerSaid: source, natural });
  }
  return out;
}

/** Normalised sentences that contain at least one detected mistake. */
function flawedSentences(turns: TranscriptTurn[]): Set<string> {
  return new Set(allCorrections(turns).map((c) => normalizeText(c.original)));
}

function deterministicStrengths(turns: TranscriptTurn[], stats: SessionStats, flawed: Set<string>): Strength[] {
  const out: Strength[] = [];
  const learner = learnerTurns(turns);
  if (stats.learnerTurns >= 5) {
    out.push({ point: `You kept the conversation going for ${stats.learnerTurns} answers.` });
  }
  if (stats.avgWordsPerTurn >= 15) {
    out.push({ point: `Your answers were detailed — about ${Math.round(stats.avgWordsPerTurn)} words each on average.` });
  } else if (stats.longestTurnWords >= 20) {
    const longest = learner.reduce((a, b) => (words(b.text).length > words(a.text).length ? b : a));
    out.push({
      point: `Your longest answer had ${stats.longestTurnWords} words.`,
      evidence: truncate(longest.text, 200),
    });
  }
  const seen = new Set<MistakeCategory>();
  for (const t of learner) {
    for (const use of detectCorrectUsage(t.text)) {
      if (seen.has(use.category) || seen.size >= 2 || flawed.has(normalizeText(use.sentence))) continue;
      seen.add(use.category);
      out.push({
        point: `You used ${categoryLabel(use.category).toLowerCase()} correctly.`,
        evidence: use.sentence,
      });
    }
  }
  const clean = learner.filter((t) => (t.corrections ?? []).length === 0).length;
  if (stats.learnerTurns >= 3 && clean / stats.learnerTurns >= 0.5) {
    out.push({ point: `${clean} of your ${stats.learnerTurns} answers had no mistakes that BolBindass detected.` });
  }
  return out;
}

function improvementGoal(corrections: Correction[], stats: SessionStats): string {
  if (corrections.length > 0) {
    const counts = new Map<MistakeCategory, number>();
    for (const c of corrections) counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
    const top = [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || MISTAKE_CATEGORIES[b[0]].priority - MISTAKE_CATEGORIES[a[0]].priority,
    )[0][0];
    return MISTAKE_CATEGORIES[top].goal;
  }
  if (stats.learnerTurns === 0) return "Next time, try answering at least three questions — even short answers help.";
  if (stats.avgWordsPerTurn < 10) {
    return "Make your answers longer: say what happened, why, and give one example (aim for 2–3 sentences).";
  }
  return "Great control today. Next time, try a harder topic or switch to Immersion mode for a longer conversation.";
}

export interface BuildReportInput {
  session: SessionRecord;
  memory: MistakeRecord[];
  nextTopic: TopicChoice | null;
  aiExtras?: AiReportExtras | null;
  now: number;
}

export function buildReport({ session, memory, nextTopic, aiExtras, now }: BuildReportInput): SessionReport {
  const turns = session.turns;
  const stats = computeStats(turns);
  const learnerText = learnerTurns(turns).map((t) => t.text).join("\n");
  const corrections = rankCorrections(allCorrections(turns));

  const countsThisSession = new Map<MistakeCategory, number>();
  for (const c of corrections) countsThisSession.set(c.category, (countsThisSession.get(c.category) ?? 0) + 1);
  const recurring = [...countsThisSession.entries()]
    .map(([category, countThisSession]) => {
      const rec = memory.find((m) => m.category === category);
      return {
        category,
        label: categoryLabel(category),
        countThisSession,
        totalCount: rec?.occurrenceCount ?? countThisSession,
      };
    })
    .filter((r) => r.totalCount >= 2)
    .sort((a, b) => b.totalCount - a.totalCount);

  const expressions: BetterExpression[] = [];
  for (const c of corrections) {
    if (c.alternative) expressions.push({ learnerSaid: c.original, natural: c.alternative });
  }
  for (const e of validExpressions(aiExtras?.betterExpressions, learnerText)) {
    if (!expressions.some((x) => normalizeText(x.learnerSaid) === normalizeText(e.learnerSaid))) expressions.push(e);
  }

  const aiVocab = validVocabulary(aiExtras?.vocabulary);
  const topicVocab = getTopic(session.topicId)?.vocabulary ?? [];

  const flawed = flawedSentences(turns);
  const strengths = [...deterministicStrengths(turns, stats, flawed)];
  for (const s of validStrengths(aiExtras?.strengths, learnerText, flawed)) {
    if (strengths.length >= 4) break;
    if (!strengths.some((x) => x.evidence && s.evidence && normalizeText(x.evidence) === normalizeText(s.evidence))) {
      strengths.push(s);
    }
  }

  const aiSummaryUsed = Boolean(aiExtras) && session.engine === "ollama";
  const notes: string[] = [
    "Pronunciation is not measured — BolBindass only sees the text your browser's speech recognition produced.",
  ];
  if (turns.some((t) => t.source === "voice")) {
    notes.push(
      "Speech recognition can change or drop words (it usually removes “um” and “uh”), so a few mistakes may be missed and some may be recognition errors.",
    );
  }
  if (session.engine === "basic") {
    notes.push("Basic practice mode: questions were scripted and corrections came only from built-in grammar rules (no AI).");
  } else if (!aiSummaryUsed) {
    notes.push("The local AI summary was not available, so strengths and vocabulary come from built-in analysis.");
  }
  if (session.mode === "immersion") {
    notes.push("Immersion mode: these corrections were hidden during the conversation.");
  }

  return {
    generatedAt: now,
    topicTitle: session.topicTitle,
    durationSec: session.durationSec,
    stats,
    corrections,
    recurring,
    betterExpressions: expressions.slice(0, 5),
    vocabulary: aiVocab.length > 0 ? aiVocab : topicVocab.slice(0, 5),
    vocabularySource: aiVocab.length > 0 ? "ai" : "topic-list",
    strengths: strengths.slice(0, 4),
    improvementGoal: improvementGoal(corrections, stats),
    nextTopic: nextTopic
      ? { id: nextTopic.topic.id, title: nextTopic.topic.title, reason: nextTopic.reason }
      : null,
    aiSummaryUsed,
    notes,
  };
}

export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m} min ${r.toString().padStart(2, "0")} s` : `${r} s`;
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  return `${m.toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}
