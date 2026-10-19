"use client";

import { BarChart3, CheckCircle2, CircleDot, Flame, Mic, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { BarList, ColumnChart } from "@/components/charts";
import { EmptyState, PageHeader } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocalData } from "@/hooks/use-local-data";
import { MEMORY_RULES } from "@/lib/mistake-memory";
import { computeStats } from "@/lib/report";
import { practiceStreak } from "@/lib/streak";
import type { MistakeRecord, MistakeStatus } from "@/lib/types";

const STATUS: Record<MistakeStatus, { tone: "bad" | "warn" | "good"; label: string; icon: typeof CircleDot }> = {
  active: { tone: "bad", label: "Active", icon: CircleDot },
  improving: { tone: "warn", label: "Improving", icon: TrendingUp },
  resolved: { tone: "good", label: "Resolved", icon: CheckCircle2 },
};

function Tile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card size="sm">
      <CardContent className="space-y-0.5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-sans text-3xl font-semibold">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function MistakeRow({ m }: { m: MistakeRecord }) {
  const s = STATUS[m.status];
  const latest = m.examples[m.examples.length - 1];
  const evidenceAfter = m.correctUses.filter((e) => e.at > m.lastSeenAt);
  const lastEvidence = m.correctUses[m.correctUses.length - 1];
  const fmt = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return (
    <li className="space-y-2 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-heading text-lg font-semibold">{m.label}</p>
        <StatusPill tone={s.tone}>
          <s.icon className="inline size-3" aria-hidden="true" /> {s.label}
        </StatusPill>
      </div>
      <p className="text-sm text-muted-foreground">
        {m.occurrenceCount} time{m.occurrenceCount === 1 ? "" : "s"} in {m.sessionIds.length} session
        {m.sessionIds.length === 1 ? "" : "s"} · last seen {fmt(m.lastSeenAt)}
        {m.lastPracticedAt ? ` · last targeted ${fmt(m.lastPracticedAt)}` : ""}
      </p>
      {latest && (
        <p className="text-sm">
          <span className="text-muted-foreground line-through decoration-destructive/50">{latest.original}</span>{" "}
          <span className="text-muted-foreground">→</span> <span className="font-medium text-secondary-foreground">{latest.corrected}</span>
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Improvement evidence: {evidenceAfter.length} correct use{evidenceAfter.length === 1 ? "" : "s"} since the last
        mistake
        {m.status !== "resolved" &&
          ` (resolved after ${MEMORY_RULES.resolveEvidence} correct uses in ${MEMORY_RULES.resolveEvidenceSessions}+ sessions and ${MEMORY_RULES.resolveCleanSessions} clean sessions)`}
        .
        {lastEvidence && <span className="block italic">Latest correct use: “{lastEvidence.sentence}”</span>}
      </p>
    </li>
  );
}

export function ProgressView() {
  const { sessions, mistakes, loading, error, loadedAt } = useLocalData();
  const finished = useMemo(
    () => sessions.filter((s) => s.endedAt !== null).sort((a, b) => a.startedAt - b.startedAt),
    [sessions],
  );

  const totals = useMemo(() => {
    let seconds = 0;
    let answers = 0;
    let words = 0;
    for (const s of finished) {
      seconds += s.durationSec;
      const st = computeStats(s.turns);
      answers += st.learnerTurns;
      words += st.totalWords;
    }
    return { seconds, answers, avg: answers ? Math.round((words / answers) * 10) / 10 : 0 };
  }, [finished]);

  const columns = useMemo(
    () =>
      finished.slice(-12).map((s) => ({
        key: s.id,
        tick: new Date(s.startedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
        value: computeStats(s.turns).avgWordsPerTurn,
        detail: s.topicTitle,
      })),
    [finished],
  );

  const ordered = useMemo(() => {
    const rank: Record<MistakeStatus, number> = { active: 0, improving: 1, resolved: 2 };
    return [...mistakes].sort((a, b) => rank[a.status] - rank[b.status] || b.occurrenceCount - a.occurrenceCount);
  }, [mistakes]);

  const bars = useMemo(
    () =>
      [...mistakes]
        .sort((a, b) => b.occurrenceCount - a.occurrenceCount)
        .slice(0, 8)
        .map((m) => ({
          key: m.key,
          label: m.label,
          value: m.occurrenceCount,
          detail: `${STATUS[m.status].label} · in ${m.sessionIds.length} session${m.sessionIds.length === 1 ? "" : "s"}`,
        })),
    [mistakes],
  );

  const streak = loadedAt ? practiceStreak(finished.map((s) => s.startedAt), loadedAt) : 0;

  return (
    <div>
      <PageHeader
        title="Progress"
        description="Built only from your saved transcripts. Pronunciation is not measured."
      />
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : finished.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No progress to show yet"
          action={
            <Button asChild>
              <Link href="/practice">
                <Mic data-icon="inline-start" /> Practise now
              </Link>
            </Button>
          }
        >
          Finish a session and your statistics, word counts and recurring mistakes will appear here.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Sessions" value={finished.length} />
            <Tile label="Practice time" value={`${Math.round(totals.seconds / 60)} min`} />
            <Tile label="Answers given" value={totals.answers} hint={`${totals.avg} words per answer on average`} />
            <Tile
              label="Practice streak"
              value={
                <span className="inline-flex items-center gap-1.5">
                  {streak} <Flame className="size-6 text-highlight" aria-hidden="true" />
                </span>
              }
              hint={streak === 1 ? "day" : "days in a row"}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Average words per answer</CardTitle>
                <CardDescription>
                  {columns.length === 1 ? "Your last session" : `Your last ${columns.length} sessions`} — longer answers usually mean more confidence.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ColumnChart data={columns} unit="words per answer" ariaLabel="Average words per answer, by session" />
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground">Show as table</summary>
                  <table className="mt-2 w-full text-left text-sm">
                    <thead className="text-muted-foreground">
                      <tr>
                        <th className="py-1 font-medium">Date</th>
                        <th className="py-1 font-medium">Topic</th>
                        <th className="py-1 text-right font-medium">Words / answer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {columns.map((c) => (
                        <tr key={c.key} className="border-t">
                          <td className="py-1">{c.tick}</td>
                          <td className="py-1">{c.detail}</td>
                          <td className="py-1 text-right tabular-nums">{c.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Mistakes by grammar area</CardTitle>
                <CardDescription>All-time count of detected mistakes.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {bars.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No mistakes recorded yet.</p>
                ) : (
                  <>
                    <BarList data={bars} unit="mistakes" ariaLabel="Mistakes by grammar area" />
                    <details className="text-sm">
                      <summary className="cursor-pointer text-muted-foreground">Show as table</summary>
                      <table className="mt-2 w-full text-left text-sm">
                        <tbody>
                          {bars.map((b) => (
                            <tr key={b.key} className="border-t">
                              <td className="py-1">{b.label}</td>
                              <td className="py-1 text-muted-foreground">{b.detail}</td>
                              <td className="py-1 text-right tabular-nums">{b.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">Recurring mistakes</h2>
            <p className="text-sm text-muted-foreground">
              A mistake is never marked resolved after one correct answer. It needs repeated correct use across sessions
              — or no repeats over {MEMORY_RULES.resolveByAbsenceSessions} practice sessions.
            </p>
            {ordered.length === 0 ? (
              <p className="text-sm text-muted-foreground">No mistakes recorded yet — keep talking!</p>
            ) : (
              <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {ordered.map((m) => (
                  <MistakeRow key={m.key} m={m} />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
