"use client";

import { ArrowRight, Cpu, HardDrive, IndianRupee, Mic, MessagesSquare, Sparkles, Target, Wand2 } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { AiSetupHelp } from "@/components/ai-setup-help";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAiStatus } from "@/hooks/use-ai-status";
import { useLocalData } from "@/hooks/use-local-data";
import { useSettings } from "@/hooks/use-settings";
import { MISTAKE_CATEGORIES } from "@/lib/categories";
import { topWeaknesses } from "@/lib/mistake-memory";
import { formatDuration } from "@/lib/report";
import { plural } from "@/lib/text";
import { rankTopics } from "@/lib/topic-selector";

const STEPS = [
  { icon: MessagesSquare, title: "The coach starts", text: "It picks a topic for you and asks one question at a time." },
  { icon: Mic, title: "You speak freely", text: "Answer by voice or by typing. Take your time — it waits until you finish." },
  { icon: Wand2, title: "Gentle corrections", text: "One or two important fixes, a natural reply, and a report at the end." },
];

export function HomeView() {
  const { settings } = useSettings();
  const ai = useAiStatus();
  const data = useLocalData();

  const suggestion = useMemo(() => {
    if (data.loading || !data.loadedAt) return null;
    return rankTopics({ settings, sessions: data.sessions, mistakes: data.mistakes, now: data.loadedAt })[0] ?? null;
  }, [data.loading, data.loadedAt, data.sessions, data.mistakes, settings]);

  const focus = useMemo(
    () => (data.loadedAt ? topWeaknesses(data.mistakes, data.loadedAt, 1)[0] : undefined),
    [data.mistakes, data.loadedAt],
  );
  const last = data.sessions.find((s) => s.endedAt !== null);
  const aiReady = ai.status?.state === "online" && ai.status.models.length > 0;

  return (
    <div className="space-y-10">
      <section className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-5">
          <p className="inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">
            <IndianRupee className="size-3.5" aria-hidden="true" /> ₹0 · runs on your own computer
          </p>
          <h1 className="text-4xl leading-tight font-semibold text-balance sm:text-5xl">
            Speak English <span className="text-primary">bindass</span> — without fear.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            {settings.name ? `Hi ${settings.name}! ` : ""}Your friendly speaking partner starts the conversation, listens to
            your whole answer, replies naturally, and gently fixes the one or two mistakes that matter most.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" className="h-12 px-6 text-base" asChild>
              <Link href="/practice">
                Start practising <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12 px-5 text-base" asChild>
              <Link href="/settings">Set my level & goal</Link>
            </Button>
          </div>
        </div>

        <Card className="paper">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="size-4 text-primary" aria-hidden="true" /> Your setup
            </CardTitle>
            <CardDescription>Everything runs locally. No API keys, no bills.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {ai.loading && !ai.status ? (
              <Skeleton className="h-6 w-48" />
            ) : aiReady ? (
              <StatusPill tone="good">Local AI ready · {ai.status?.recommendedModel}</StatusPill>
            ) : (
              <>
                <StatusPill tone="warn">Local AI not running</StatusPill>
                <p className="text-muted-foreground">
                  {ai.status?.message ?? ai.error ?? "Could not check."} You can still practise in Basic mode.
                </p>
                <details className="rounded-lg bg-muted/60 p-3">
                  <summary className="cursor-pointer font-medium">How to start the local AI (Windows)</summary>
                  <div className="pt-3">
                    <AiSetupHelp status={ai.status} />
                  </div>
                </details>
              </>
            )}
            <p className="flex items-center gap-2 text-muted-foreground">
              <HardDrive className="size-4 shrink-0" aria-hidden="true" /> Transcripts & progress are saved only in this browser.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-highlight" aria-hidden="true" /> Suggested topic
            </CardDescription>
            {suggestion ? (
              <CardTitle className="font-heading text-lg font-semibold">{suggestion.topic.title}</CardTitle>
            ) : (
              <Skeleton className="h-6 w-3/4" />
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {suggestion && <p className="text-sm text-muted-foreground">{suggestion.reason}</p>}
            <Button variant="outline" size="sm" asChild disabled={!suggestion}>
              <Link href={suggestion ? `/practice?topic=${suggestion.topic.id}` : "/practice"}>
                Practise this <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Target className="size-3.5 text-highlight" aria-hidden="true" /> Focus area
            </CardDescription>
            <CardTitle className="font-heading text-lg font-semibold">
              {data.loading ? <Skeleton className="h-6 w-1/2" /> : focus ? focus.label : "Nothing yet"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {focus ? (
              <>
                <p>
                  Seen {focus.occurrenceCount} time{focus.occurrenceCount === 1 ? "" : "s"} across {focus.sessionIds.length} session
                  {focus.sessionIds.length === 1 ? "" : "s"}.
                </p>
                <p>{MISTAKE_CATEGORIES[focus.category].goal}</p>
              </>
            ) : (
              <p>After a session, your most frequent grammar pattern shows up here so future topics can target it.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Last session</CardDescription>
            <CardTitle className="font-heading text-lg font-semibold">
              {data.loading ? <Skeleton className="h-6 w-2/3" /> : last ? last.topicTitle : "No sessions yet"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {last ? (
              <>
                <p>
                  {formatDuration(last.durationSec)} · {plural(last.turns.filter((t) => t.role === "learner").length, "answer")} ·{" "}
                  {plural(last.report?.corrections.length ?? 0, "correction")}
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/history/${last.id}`}>
                    Open report <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
              </>
            ) : (
              <p>Your first conversation will appear here.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">How a session works</h2>
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3 rounded-2xl border bg-card p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary font-heading font-semibold text-primary">
                {i + 1}
              </span>
              <div>
                <p className="flex items-center gap-1.5 font-semibold">
                  <s.icon className="size-4 text-primary" aria-hidden="true" /> {s.title}
                </p>
                <p className="text-sm text-muted-foreground">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground">
          Voice works in turns through your browser&apos;s speech features — it is not a real-time voice AI, and it
          doesn&apos;t measure pronunciation.
        </p>
      </section>
    </div>
  );
}
