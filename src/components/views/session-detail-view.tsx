"use client";

import { ArrowLeft, FileQuestion, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { CorrectionCard } from "@/components/correction-card";
import { EmptyState } from "@/components/empty-state";
import { SessionReportView } from "@/components/session-report";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettings } from "@/hooks/use-settings";
import { deleteSession, getSession, listMistakes, listSessions, replaceMistakes, saveSession } from "@/lib/db";
import { finalizeSession } from "@/lib/finalize";
import type { SessionRecord } from "@/lib/types";

type LoadState = { status: "loading" } | { status: "missing" } | { status: "error"; message: string } | { status: "ready"; session: SessionRecord };

export function SessionDetailView() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const { settings } = useSettings();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSession(id)
      .then((s) => {
        if (!cancelled) setState(s ? { status: "ready", session: s } : { status: "missing" });
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ status: "error", message: err instanceof Error ? err.message : "Could not load." });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }
  if (state.status !== "ready") {
    return (
      <EmptyState
        icon={FileQuestion}
        title={state.status === "missing" ? "Session not found" : "Couldn't load this session"}
        action={
          <Button asChild variant="outline">
            <Link href="/history">Back to history</Link>
          </Button>
        }
      >
        {state.status === "missing" ? "It may have been deleted, or it was saved in another browser." : state.message}
      </EmptyState>
    );
  }

  const session = state.session;
  const unfinished = session.endedAt === null || !session.report;

  const finishNow = async () => {
    setFinishing(true);
    try {
      const final = await finalizeSession(session, false, {
        settings,
        now: Date.now(),
        store: { listSessions, listMistakes, replaceMistakes, saveSession },
      });
      setState({ status: "ready", session: final });
      toast.success("Report created and mistake memory updated.");
    } catch {
      toast.error("Could not create the report.");
    } finally {
      setFinishing(false);
    }
  };

  const remove = async () => {
    await deleteSession(session.id);
    toast.success("Session deleted.");
    router.push("/history");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" asChild className="w-fit">
          <Link href="/history">
            <ArrowLeft data-icon="inline-start" /> All sessions
          </Link>
        </Button>
        <ConfirmButton
          variant="outline"
          size="sm"
          title="Delete this session?"
          description="The transcript and report are removed permanently, and your mistake memory is recalculated."
          confirmLabel="Delete session"
          onConfirm={() => void remove()}
        >
          <Trash2 data-icon="inline-start" /> Delete
        </ConfirmButton>
      </div>

      {unfinished && (
        <Card className="border-highlight/50 bg-accent/40">
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">This session wasn&apos;t ended properly</p>
              <p className="text-sm text-muted-foreground">
                The tab may have been closed. Create the report from the saved transcript (built-in analysis, no AI call).
              </p>
            </div>
            <Button onClick={finishNow} disabled={finishing}>
              {finishing && <Loader2 data-icon="inline-start" className="animate-spin" />} Create report
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue={unfinished ? "transcript" : "report"}>
        <TabsList>
          <TabsTrigger value="report" disabled={unfinished}>
            Report
          </TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
        </TabsList>
        <TabsContent value="report" className="pt-3">
          <SessionReportView session={session} />
        </TabsContent>
        <TabsContent value="transcript" className="pt-3">
          <Card>
            <CardContent className="space-y-4">
              <h1 className="text-2xl font-semibold">{session.topicTitle}</h1>
              {session.turns.map((t) => (
                <div key={t.id} className="space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase">
                    {t.role === "coach"
                      ? t.source === "basic"
                        ? "Coach · scripted (Basic mode)"
                        : t.helper
                          ? "Coach · simpler explanation"
                          : "Coach · local AI"
                      : `You · ${t.source === "voice" ? "spoken" : "typed"}`}
                  </p>
                  <p className={t.role === "learner" ? "rounded-xl bg-secondary px-3 py-2" : ""}>{t.text}</p>
                  {(t.corrections ?? []).length > 0 && (
                    <div className="grid gap-2 md:grid-cols-2">
                      {t.corrections!.map((c) => (
                        <CorrectionCard key={c.id} correction={c} compact />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
