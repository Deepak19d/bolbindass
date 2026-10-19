import { categoryLabel } from "./categories";
import { detectCorrectUsage } from "./grammar-rules";
import type {
  CorrectionSource,
  MistakeCategory,
  MistakeRecord,
  MistakeStatus,
  SessionRecord,
} from "./types";

/** Tunables for when a recurring mistake counts as improving / resolved. */
export const MEMORY_RULES = {
  /** Correct uses (after the last mistake) needed before "resolved". */
  resolveEvidence: 3,
  /** …spread over at least this many different sessions. */
  resolveEvidenceSessions: 2,
  /** …and the mistake must be absent from this many most-recent sessions. */
  resolveCleanSessions: 2,
  /** Without detectable evidence, absent from this many sessions → resolved. */
  resolveByAbsenceSessions: 6,
  /** Absent from this many recent sessions → "improving". */
  improvingAbsenceSessions: 3,
  /** A session must have this many learner turns to count as "practice". */
  substantiveTurns: 3,
  maxExamples: 8,
  maxEvidence: 20,
  maxSessionIds: 30,
} as const;

export interface Occurrence {
  category: MistakeCategory;
  original: string;
  corrected: string;
  explanation: string;
  source: CorrectionSource;
  at: number;
}

export interface SessionOutcome {
  sessionId: string;
  at: number;
  occurrences: Occurrence[];
  correctUses: { category: MistakeCategory; sentence: string; at: number }[];
  practisedCategories: MistakeCategory[];
}

export function isSubstantive(session: Pick<SessionRecord, "turns">): boolean {
  return session.turns.filter((t) => t.role === "learner").length >= MEMORY_RULES.substantiveTurns;
}

/** Extract what memory needs from a finished session transcript. */
export function deriveOutcome(session: SessionRecord): SessionOutcome {
  const occurrences: Occurrence[] = [];
  const correctUses: SessionOutcome["correctUses"] = [];
  for (const turn of session.turns) {
    if (turn.role !== "learner") continue;
    for (const c of turn.corrections ?? []) {
      occurrences.push({
        category: c.category,
        original: c.original,
        corrected: c.corrected,
        explanation: c.explanation,
        source: c.source,
        at: turn.at,
      });
    }
    for (const use of detectCorrectUsage(turn.text)) {
      correctUses.push({ ...use, at: turn.at });
    }
  }
  return {
    sessionId: session.id,
    at: session.endedAt ?? session.startedAt,
    occurrences,
    correctUses,
    practisedCategories: session.focusCategories,
  };
}

function lastN<T>(items: T[], n: number): T[] {
  return items.length > n ? items.slice(items.length - n) : items;
}

export interface PracticeSessionRef {
  id: string;
  /** When the session ended. */
  at: number;
}

/**
 * Decide a record's status.
 * @param practiceSessions substantive sessions (any order).
 */
export function computeStatus(record: MistakeRecord, practiceSessions: PracticeSessionRef[]): MistakeStatus {
  const evidenceAfter = record.correctUses.filter((e) => e.at > record.lastSeenAt);
  const evidenceSessions = new Set(evidenceAfter.map((e) => e.sessionId));
  const occurredIn = new Set(record.sessionIds);
  // Practice sessions after the mistake was last seen in which it did not occur.
  const cleanStreak = practiceSessions.filter(
    (s) => s.at > record.lastSeenAt && !occurredIn.has(s.id),
  ).length;

  if (
    evidenceAfter.length >= MEMORY_RULES.resolveEvidence &&
    evidenceSessions.size >= MEMORY_RULES.resolveEvidenceSessions &&
    cleanStreak >= MEMORY_RULES.resolveCleanSessions
  ) {
    return "resolved";
  }
  if (cleanStreak >= MEMORY_RULES.resolveByAbsenceSessions) return "resolved";
  if (evidenceAfter.length >= 1 || cleanStreak >= MEMORY_RULES.improvingAbsenceSessions) {
    return "improving";
  }
  return "active";
}

/**
 * Fold one finished session into the learner's mistake memory.
 * @param practiceSessions substantive sessions so far, including this one if substantive.
 */
export function updateMistakeMemory(
  existing: MistakeRecord[],
  outcome: SessionOutcome,
  practiceSessions: PracticeSessionRef[],
): MistakeRecord[] {
  const byKey = new Map(existing.map((r) => [r.key, structuredClone(r)]));

  for (const occ of [...outcome.occurrences].sort((a, b) => a.at - b.at)) {
    const key = occ.category;
    let rec = byKey.get(key);
    if (!rec) {
      rec = {
        key,
        category: occ.category,
        label: categoryLabel(occ.category),
        examples: [],
        occurrenceCount: 0,
        sessionIds: [],
        firstSeenAt: occ.at,
        lastSeenAt: occ.at,
        lastPracticedAt: null,
        correctUses: [],
        status: "active",
      };
      byKey.set(key, rec);
    }
    rec.occurrenceCount += 1;
    rec.lastSeenAt = Math.max(rec.lastSeenAt, occ.at);
    if (!rec.sessionIds.includes(outcome.sessionId)) rec.sessionIds.push(outcome.sessionId);
    rec.sessionIds = lastN(rec.sessionIds, MEMORY_RULES.maxSessionIds);
    const dupe = rec.examples.some((e) => e.original === occ.original && e.sessionId === outcome.sessionId);
    if (!dupe) {
      rec.examples.push({
        original: occ.original,
        corrected: occ.corrected,
        explanation: occ.explanation,
        sessionId: outcome.sessionId,
        at: occ.at,
        source: occ.source,
      });
      rec.examples = lastN(rec.examples, MEMORY_RULES.maxExamples);
    }
  }

  // Evidence only matters for weaknesses we are already tracking.
  for (const use of outcome.correctUses) {
    const rec = byKey.get(use.category);
    if (!rec) continue;
    const dupe = rec.correctUses.some((e) => e.sentence === use.sentence && e.sessionId === outcome.sessionId);
    if (dupe) continue;
    rec.correctUses.push({ sentence: use.sentence, sessionId: outcome.sessionId, at: use.at });
    rec.correctUses = lastN(rec.correctUses, MEMORY_RULES.maxEvidence);
  }

  for (const cat of outcome.practisedCategories) {
    const rec = byKey.get(cat);
    if (rec) rec.lastPracticedAt = outcome.at;
  }

  for (const rec of byKey.values()) {
    rec.status = computeStatus(rec, practiceSessions);
  }
  return [...byKey.values()];
}

/** Rebuild memory from scratch (used after deleting a session). */
export function rebuildMemory(sessions: SessionRecord[]): MistakeRecord[] {
  const ordered = [...sessions]
    .filter((s) => s.endedAt !== null)
    .sort((a, b) => a.startedAt - b.startedAt);
  let memory: MistakeRecord[] = [];
  const practice: PracticeSessionRef[] = [];
  for (const s of ordered) {
    if (isSubstantive(s)) practice.push(practiceRef(s));
    memory = updateMistakeMemory(memory, deriveOutcome(s), practice);
  }
  return memory;
}

export function practiceRef(s: SessionRecord): PracticeSessionRef {
  return { id: s.id, at: s.endedAt ?? s.startedAt };
}

/** Weight recent, frequent, unresolved mistakes highest. */
export function weaknessWeight(rec: MistakeRecord, now: number): number {
  if (rec.status === "resolved") return 0;
  const days = Math.max(0, (now - rec.lastSeenAt) / 86_400_000);
  const recency = 1 / (1 + days / 7);
  const statusFactor = rec.status === "improving" ? 0.5 : 1;
  return rec.occurrenceCount * recency * statusFactor;
}

export function topWeaknesses(records: MistakeRecord[], now: number, n = 3): MistakeRecord[] {
  return [...records]
    .filter((r) => r.status !== "resolved")
    .sort((a, b) => weaknessWeight(b, now) - weaknessWeight(a, now))
    .slice(0, n);
}

/** Categories that have come up more than once and are not resolved. */
export function recurringCategories(records: MistakeRecord[]): Set<MistakeCategory> {
  return new Set(
    records.filter((r) => r.status !== "resolved" && r.occurrenceCount >= 2).map((r) => r.category),
  );
}
