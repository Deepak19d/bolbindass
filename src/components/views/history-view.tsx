"use client";

import { ChevronRight, Download, History, Mic, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState, PageHeader } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocalData } from "@/hooks/use-local-data";
import { deleteAllHistory, deleteSession } from "@/lib/db";
import { downloadHistoryExport } from "@/lib/download";
import { formatDuration } from "@/lib/report";
import { plural } from "@/lib/text";
import { CORRECTION_MODES } from "@/lib/settings";
import { TOPIC_CATEGORY_LABELS } from "@/lib/topics";

export function HistoryView() {
  const { sessions, loading, error, reload } = useLocalData();

  const exportNow = async () => {
    try {
      const n = await downloadHistoryExport();
      toast.success(`Exported ${n} session${n === 1 ? "" : "s"} to a JSON file.`);
    } catch {
      toast.error("Export failed.");
    }
  };

  const removeAll = async () => {
    try {
      await deleteAllHistory();
      toast.success("All learning history deleted from this browser.");
      reload();
    } catch {
      toast.error("Could not delete history.");
    }
  };

  const removeOne = async (id: string) => {
    try {
      await deleteSession(id);
      toast.success("Session deleted. Mistake memory was recalculated.");
      reload();
    } catch {
      toast.error("Could not delete the session.");
    }
  };

  return (
    <div>
      <PageHeader
        title="History"
        description="Every conversation is saved as text in this browser only. Audio is never recorded."
        actions={
          sessions.length > 0 && (
            <>
              <Button variant="outline" onClick={exportNow}>
                <Download data-icon="inline-start" /> Export JSON
              </Button>
              <ConfirmButton
                title="Delete all learning history?"
                description="This permanently deletes every session, transcript and your mistake memory from this browser. Export first if you want a copy. Settings are kept."
                confirmLabel="Delete everything"
                onConfirm={removeAll}
              >
                <Trash2 data-icon="inline-start" /> Delete all
              </ConfirmButton>
            </>
          )
        }
      />

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Couldn&apos;t read your local history</AlertTitle>
          <AlertDescription>{error} — local storage may be disabled (for example in a private window).</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : sessions.length === 0 && !error ? (
        <EmptyState
          icon={History}
          title="No sessions yet"
          action={
            <Button asChild>
              <Link href="/practice">
                <Mic data-icon="inline-start" /> Start your first conversation
              </Link>
            </Button>
          }
        >
          Finished conversations appear here with their transcript, corrections and report.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => {
            const answers = s.turns.filter((t) => t.role === "learner").length;
            const corrections = s.report?.corrections.length ?? s.turns.reduce((n, t) => n + (t.corrections?.length ?? 0), 0);
            return (
              <li key={s.id}>
                <Card className="py-4">
                  <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Link href={`/history/${s.id}`} className="group min-w-0 flex-1 space-y-1.5">
                      <p className="text-xs text-muted-foreground">
                        {new Date(s.startedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                      <p className="flex items-center gap-1 font-heading text-lg font-semibold group-hover:text-primary">
                        {s.topicTitle} <ChevronRight className="size-4 opacity-50" aria-hidden="true" />
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {s.endedAt === null && <StatusPill tone="warn">Unfinished</StatusPill>}
                        <Badge variant="secondary">{TOPIC_CATEGORY_LABELS[s.topicCategory]}</Badge>
                        <Badge variant="outline">{s.engine === "ollama" ? "Local AI" : "Basic mode"}</Badge>
                        <Badge variant="outline">{CORRECTION_MODES[s.mode].label}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {s.endedAt !== null ? `${formatDuration(s.durationSec)} · ` : ""}
                          {plural(answers, "answer")} · {plural(corrections, "correction")}
                        </span>
                      </div>
                    </Link>
                    <ConfirmButton
                      variant="ghost"
                      size="sm"
                      title="Delete this session?"
                      description="The transcript and report are removed, and your mistake memory is recalculated without it."
                      confirmLabel="Delete session"
                      onConfirm={() => void removeOne(s.id)}
                    >
                      <Trash2 data-icon="inline-start" /> Delete
                    </ConfirmButton>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
