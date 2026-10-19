import { isSubstantive, practiceRef, updateMistakeMemory, deriveOutcome } from "./mistake-memory";
import { buildReport, learnerTurns, type AiReportExtras } from "./report";
import { selectTopic } from "./topic-selector";
import type { MistakeRecord, SessionRecord, Settings } from "./types";

export interface FinalizeStore {
  listSessions(): Promise<SessionRecord[]>;
  listMistakes(): Promise<MistakeRecord[]>;
  replaceMistakes(records: MistakeRecord[]): Promise<void>;
  saveSession(session: SessionRecord): Promise<void>;
}

export interface FinalizeOptions {
  settings: Settings;
  now: number;
  store: FinalizeStore;
  /** Optional local-AI summary; failures are ignored (report still works). */
  getAiExtras?: (session: SessionRecord) => Promise<AiReportExtras | null>;
  rng?: () => number;
}

/** End time for a session: now if it is being ended live, else the last turn (closed tab). */
export function sessionEndTime(session: SessionRecord, now: number, live: boolean): number {
  if (session.endedAt) return session.endedAt;
  if (live) return now;
  const last = session.turns[session.turns.length - 1];
  return last ? last.at : session.startedAt;
}

/**
 * Finish a session: update mistake memory, choose the next topic, build the
 * report from the transcript, and save everything locally.
 */
export async function finalizeSession(
  session: SessionRecord,
  live: boolean,
  opts: FinalizeOptions,
): Promise<SessionRecord> {
  const endedAt = sessionEndTime(session, opts.now, live);
  const ended: SessionRecord = {
    ...session,
    endedAt,
    durationSec: Math.max(0, Math.round((endedAt - session.startedAt) / 1000)),
    // Any analysis still "pending" keeps its rule-based corrections.
    turns: session.turns.map((t) => (t.analysis === "pending" ? { ...t, analysis: "skipped" } : t)),
  };

  const [others, existing] = await Promise.all([opts.store.listSessions(), opts.store.listMistakes()]);
  const finished = others.filter((s) => s.id !== ended.id && s.endedAt !== null);
  const practice = [...finished, ended].filter(isSubstantive).map(practiceRef);
  const memory = updateMistakeMemory(existing, deriveOutcome(ended), practice);
  await opts.store.replaceMistakes(memory);

  const nextTopic = selectTopic(
    { settings: opts.settings, sessions: [ended, ...finished], mistakes: memory, now: opts.now },
    opts.rng,
  );

  let extras: AiReportExtras | null = null;
  if (opts.getAiExtras && ended.engine === "ollama" && learnerTurns(ended.turns).length >= 2) {
    try {
      extras = await opts.getAiExtras(ended);
    } catch {
      extras = null;
    }
  }

  const report = buildReport({ session: ended, memory, nextTopic, aiExtras: extras, now: opts.now });
  const final = { ...ended, report };
  await opts.store.saveSession(final);
  return final;
}
