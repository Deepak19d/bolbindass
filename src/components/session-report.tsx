import { ArrowRight, BookOpen, Info, Repeat2, Sparkles, Target, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { CorrectionCard } from "@/components/correction-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDuration } from "@/lib/report";
import type { SessionRecord } from "@/lib/types";

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-muted/70 px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-heading text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="size-4 text-primary" aria-hidden="true" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

export function SessionReportView({ session }: { session: SessionRecord }) {
  const report = session.report;
  if (!report) return null;
  const { stats } = report;
  const date = new Date(session.startedAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="space-y-5">
      <Card className="border-0 bg-primary text-primary-foreground ring-0">
        <CardContent className="space-y-4 py-2">
          <div className="space-y-1">
            <p className="text-sm opacity-80">
              {date} · {session.engine === "ollama" ? `Local AI (${session.model})` : "Basic practice mode"}
            </p>
            <h2 className="text-2xl font-semibold">{report.topicTitle}</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 text-foreground sm:grid-cols-4">
            <Stat label="Duration" value={formatDuration(report.durationSec)} />
            <Stat label="Your answers" value={stats.learnerTurns} />
            <Stat label="Words spoken" value={stats.totalWords} />
            <Stat label="Avg words / answer" value={stats.avgWordsPerTurn} />
          </div>
        </CardContent>
      </Card>

      <div className="rounded-2xl border-2 border-highlight/60 bg-accent/50 p-4 sm:p-5">
        <p className="flex items-center gap-2 text-sm font-semibold text-accent-foreground">
          <Target className="size-4" aria-hidden="true" /> Your one goal for next time
        </p>
        <p className="mt-1.5 text-base">{report.improvementGoal}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section icon={ThumbsUp} title="Strengths observed">
          {report.strengths.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not enough answers to judge strengths this time.</p>
          ) : (
            <ul className="space-y-2.5">
              {report.strengths.map((s, i) => (
                <li key={i} className="text-sm">
                  <p>{s.point}</p>
                  {s.evidence && (
                    <p className="mt-0.5 border-l-2 border-primary/40 pl-2 text-muted-foreground italic">“{s.evidence}”</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section icon={Repeat2} title="Recurring grammar mistakes">
          {report.recurring.length === 0 ? (
            <p className="text-sm text-muted-foreground">No repeating patterns yet. They appear here once a mistake type shows up more than once.</p>
          ) : (
            <ul className="space-y-2">
              {report.recurring.map((r) => (
                <li key={r.category} className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium">{r.label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {r.countThisSession} today · {r.totalCount} total
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section icon={Sparkles} title={`Important corrections (${report.corrections.length})`}>
        {report.corrections.length === 0 ? (
          <p className="text-sm text-muted-foreground">No mistakes were detected in your answers this session.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {report.corrections.slice(0, 8).map((c) => (
              <CorrectionCard key={c.id} correction={c} compact />
            ))}
          </div>
        )}
        {report.corrections.length > 8 && (
          <p className="text-xs text-muted-foreground">Showing the 8 most important of {report.corrections.length}.</p>
        )}
      </Section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section icon={Sparkles} title="Better natural expressions">
          {report.betterExpressions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing to rephrase this time.</p>
          ) : (
            <ul className="space-y-3">
              {report.betterExpressions.map((e, i) => (
                <li key={i} className="text-sm">
                  <p className="text-muted-foreground">You said: “{e.learnerSaid}”</p>
                  <p className="font-medium text-secondary-foreground">More natural: “{e.natural}”</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section icon={BookOpen} title="Useful vocabulary">
          <ul className="space-y-2.5">
            {report.vocabulary.map((v) => (
              <li key={v.word} className="text-sm">
                <p>
                  <span className="font-semibold text-primary">{v.word}</span> — {v.meaning}
                </p>
                {v.example && <p className="text-muted-foreground italic">“{v.example}”</p>}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {report.vocabularySource === "ai"
              ? "Suggested by your local AI for this topic."
              : "From BolBindass's built-in word list for this topic."}
          </p>
        </Section>
      </div>

      {report.nextTopic && (
        <Card>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Suggested next topic</p>
              <p className="font-heading text-lg font-semibold">{report.nextTopic.title}</p>
              <p className="text-sm text-muted-foreground">{report.nextTopic.reason}</p>
            </div>
            <Button asChild>
              <Link href={`/practice?topic=${encodeURIComponent(report.nextTopic.id)}`}>
                Practise this next <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-1.5 rounded-xl bg-muted/60 p-4 text-xs text-muted-foreground">
        {report.notes.map((n) => (
          <p key={n} className="flex gap-2">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" /> {n}
          </p>
        ))}
      </div>
    </div>
  );
}
