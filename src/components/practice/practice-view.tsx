"use client";

import { AlertTriangle, History, Loader2, PlusCircle, RotateCcw, Square, Timer } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Composer } from "@/components/practice/composer";
import { PracticeSetup } from "@/components/practice/practice-setup";
import { Transcript } from "@/components/practice/transcript";
import { SessionReportView } from "@/components/session-report";
import { StatusPill } from "@/components/status-pill";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAiStatus } from "@/hooks/use-ai-status";
import { useNow } from "@/hooks/use-now";
import { usePracticeSession } from "@/hooks/use-practice-session";
import { useSettings } from "@/hooks/use-settings";
import { listMistakes, listSessions } from "@/lib/db";
import { decideEngine } from "@/lib/engine";
import { recurringCategories } from "@/lib/mistake-memory";
import { isActivePhase } from "@/lib/practice-machine";
import { formatClock } from "@/lib/report";
import { CORRECTION_MODES } from "@/lib/settings";
import { detectSpeechSupport, type SpeechSupport } from "@/lib/speech";
import { manualChoice, selectTopic, type TopicChoice, type TopicSelectionInput } from "@/lib/topic-selector";
import { getTopic } from "@/lib/topics";
import type { MistakeRecord, SessionRecord } from "@/lib/types";

const noopSubscribe = () => () => {};
let supportCache: SpeechSupport | null = null;
function getSupport(): SpeechSupport {
  supportCache ??= detectSpeechSupport(window as never);
  return supportCache;
}

export function PracticeView() {
  const { settings, update } = useSettings();
  const ai = useAiStatus();
  const practice = usePracticeSession(settings);
  const { state } = practice;
  const searchParams = useSearchParams();
  const requestedTopic = searchParams.get("topic");
  const speech = useSyncExternalStore(noopSubscribe, getSupport, () => null);

  const [history, setHistory] = useState<{ sessions: SessionRecord[]; mistakes: MistakeRecord[] } | null>(null);
  const [choice, setChoice] = useState<TopicChoice | null>(null);
  const [basicChosen, setBasicChosen] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);

  const decision = decideEngine(ai.status, settings.model, basicChosen);

  // Load local history, then let the topic selector pick today's topic.
  const selectionSettings = useMemo(
    () => ({ level: settings.level, interests: settings.interests, goal: settings.goal }),
    [settings.level, settings.interests, settings.goal],
  );
  useEffect(() => {
    let cancelled = false;
    Promise.all([listSessions(), listMistakes()])
      .catch(() => [[], []] as [SessionRecord[], MistakeRecord[]])
      .then(([sessions, mistakes]) => {
        if (cancelled) return;
        setHistory({ sessions, mistakes });
        const input: TopicSelectionInput = { settings: selectionSettings, sessions, mistakes, now: Date.now() };
        const requested = requestedTopic ? getTopic(requestedTopic) : undefined;
        setChoice(requested ? manualChoice(requested, input) : selectTopic(input));
      });
    return () => {
      cancelled = true;
    };
  }, [requestedTopic, selectionSettings, historyVersion]);

  const selectionInput = (): TopicSelectionInput => ({
    settings: selectionSettings,
    sessions: history?.sessions ?? [],
    mistakes: history?.mistakes ?? [],
    now: Date.now(),
  });

  const recurring = useMemo(() => recurringCategories(history?.mistakes ?? []), [history]);

  const active = isActivePhase(state.phase);
  const now = useNow(active);
  const elapsed = state.session && now ? Math.max(0, (now - state.session.startedAt) / 1000) : 0;
  const targetSec = settings.sessionTargetMinutes * 60;

  const start = () => {
    if (!choice) return;
    if (decision.engine === "ollama") void practice.start(choice, "ollama", decision.model);
    else if (decision.engine === "basic") void practice.start(choice, "basic", null);
  };

  const end = async () => {
    const result = await practice.end();
    if (result === "discarded") toast("Session discarded — you hadn't answered yet.");
    if (result === "ended") setHistoryVersion((v) => v + 1);
  };

  // ── Setup ──────────────────────────────────────────────────────────────
  if (state.phase === "setup") {
    return (
      <PracticeSetup
        settings={settings}
        onModeChange={(m) => update({ correctionMode: m })}
        onModelChange={(model) => update({ model })}
        ai={ai}
        decision={decision}
        basicChosen={basicChosen}
        onChooseBasic={setBasicChosen}
        choice={choice}
        loadingTopic={!history}
        onShuffle={() => setChoice((c) => selectTopic(selectionInput(), Math.random, c ? [c.topic.id] : []))}
        onPickTopic={(id) => {
          const t = getTopic(id);
          if (t) setChoice(manualChoice(t, selectionInput()));
        }}
        onStart={start}
        speech={speech}
        error={state.error}
      />
    );
  }

  const session = state.session;
  if (!session) return null;

  // ── Ending / ended ─────────────────────────────────────────────────────
  if (state.phase === "ending") {
    return (
      <Card className="mx-auto max-w-xl">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
          <h2 className="text-xl font-semibold">Preparing your session report…</h2>
          {practice.summarizing ? (
            <>
              <p className="text-sm text-muted-foreground">
                Your local AI is writing a short summary from your transcript. On a laptop CPU this can take up to a minute.
              </p>
              <Button variant="outline" size="sm" onClick={practice.skipSummary}>
                Skip the AI summary
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Saving your transcript and updating your mistake memory.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (state.phase === "ended") {
    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-3xl font-semibold">Session report</h1>
          <div className="flex flex-wrap gap-2">
            <Button onClick={practice.reset}>
              <PlusCircle data-icon="inline-start" /> New session
            </Button>
            <Button variant="outline" asChild>
              <Link href="/history">
                <History data-icon="inline-start" /> All sessions
              </Link>
            </Button>
          </div>
        </div>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        <SessionReportView session={session} />
      </div>
    );
  }

  // ── Live conversation ─────────────────────────────────────────────────
  const listening = practice.recognition.listening;
  const micTone = !practice.recognition.supported
    ? "bad"
    : practice.recognition.error
      ? "bad"
      : listening
        ? "live"
        : practice.micOn
          ? "good"
          : "idle";
  const micLabel = !practice.recognition.supported
    ? "Mic: not supported"
    : practice.recognition.error?.permission
      ? "Mic: blocked"
      : practice.recognition.error
        ? "Mic: error"
        : listening
          ? "Mic: listening"
          : practice.micOn
            ? "Mic: ready"
            : "Mic: muted";

  return (
    <div className="space-y-4">
      <Card className="gap-3 py-3">
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-1.5">
            <h1 className="truncate font-heading text-xl font-semibold">{session.topicTitle}</h1>
            <div className="flex flex-wrap gap-1.5">
              {session.engine === "ollama" ? (
                <StatusPill tone="good" title="Runs on this computer">
                  Local AI · {session.model}
                </StatusPill>
              ) : (
                <StatusPill tone="warn">Basic mode — scripted, not AI</StatusPill>
              )}
              <StatusPill tone={micTone}>{micLabel}</StatusPill>
              <StatusPill tone={!practice.tts.supported ? "bad" : practice.tts.speaking ? "live" : settings.autoSpeak ? "good" : "idle"}>
                {!practice.tts.supported
                  ? "Voice: not supported"
                  : practice.tts.speaking
                    ? "Voice: speaking"
                    : settings.autoSpeak
                      ? "Voice: on"
                      : "Voice: off"}
              </StatusPill>
              <Badge variant="outline">{CORRECTION_MODES[session.mode].label} mode</Badge>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="min-w-28 space-y-1" aria-label="Session timer">
              <p className="flex items-center gap-1.5 font-mono text-lg font-semibold tabular-nums">
                <Timer className="size-4 text-primary" aria-hidden="true" /> {formatClock(elapsed)}
              </p>
              <Progress value={Math.min(100, (elapsed / targetSec) * 100)} aria-label={`Target ${settings.sessionTargetMinutes} minutes`} />
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Square data-icon="inline-start" /> End session
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>End this session?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You&apos;ll get a report built from your transcript, and your mistake memory will be updated.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep talking</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void end()}>End & see report</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {state.error && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {state.error}
          </p>
          <div className="flex shrink-0 flex-wrap gap-2">
            {session.turns[session.turns.length - 1]?.role === "learner" && (
              <Button size="sm" variant="outline" onClick={practice.retry}>
                <RotateCcw data-icon="inline-start" /> Try again
              </Button>
            )}
            {session.engine === "ollama" && (
              <Button size="sm" variant="secondary" onClick={practice.switchToBasic}>
                Continue in Basic mode (no AI)
              </Button>
            )}
          </div>
        </div>
      )}

      <Card className="py-0">
        <CardContent
          data-scroll-container
          className="h-[clamp(18rem,calc(100dvh-25rem),44rem)] overflow-y-auto overscroll-contain px-3 py-5 sm:px-5"
        >
          <Transcript session={session} phase={state.phase} streamingText={state.streamingText} recurring={recurring} />
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardContent>
          <Composer practice={practice} />
        </CardContent>
      </Card>
    </div>
  );
}
