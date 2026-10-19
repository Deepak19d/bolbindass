"use client";

import { Bot, Loader2, User } from "lucide-react";
import { useEffect, useRef } from "react";
import { CorrectionCard } from "@/components/correction-card";
import { correctionsToShow } from "@/lib/corrections";
import type { Phase } from "@/lib/practice-machine";
import type { CorrectionMode, MistakeCategory, SessionRecord, TranscriptTurn } from "@/lib/types";
import { cn } from "@/lib/utils";

function TypingDots() {
  return (
    <span className="inline-flex gap-1" aria-hidden="true">
      <span className="typing-dot size-1.5 rounded-full bg-muted-foreground" />
      <span className="typing-dot size-1.5 rounded-full bg-muted-foreground" />
      <span className="typing-dot size-1.5 rounded-full bg-muted-foreground" />
    </span>
  );
}

function coachLabel(turn: TranscriptTurn): string {
  if (turn.helper) return "Coach · simpler explanation";
  return turn.source === "basic" ? "Coach · scripted question (Basic mode, not AI)" : "Coach · local AI";
}

function LearnerCorrections({
  turn,
  mode,
  recurring,
}: {
  turn: TranscriptTurn;
  mode: CorrectionMode;
  recurring: ReadonlySet<MistakeCategory>;
}) {
  const all = turn.corrections ?? [];
  if (mode === "immersion") {
    return all.length > 0 ? (
      <p className="text-right text-xs text-muted-foreground">Corrections saved for your end-of-session report.</p>
    ) : null;
  }
  if (turn.analysis === "pending") {
    return (
      <p className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Checking your sentence…
      </p>
    );
  }
  const shown = correctionsToShow(all, mode, recurring);
  return (
    <div className="space-y-2">
      {shown.map((c) => (
        <CorrectionCard key={c.id} correction={c} compact />
      ))}
      {all.length > shown.length && (
        <p className="text-right text-xs text-muted-foreground">
          +{all.length - shown.length} more in your report.
        </p>
      )}
      {turn.analysis === "failed" && (
        <p className="text-right text-xs text-muted-foreground">
          The local AI check didn&apos;t finish{all.length ? " — showing the built-in grammar check only" : ""}.
        </p>
      )}
      {turn.analysis === "done" && all.length === 0 && turn.text.split(/\s+/).length >= 4 && (
        <p className="text-right text-xs text-success">No mistakes detected. Nice!</p>
      )}
    </div>
  );
}

export function Transcript({
  session,
  phase,
  streamingText,
  recurring,
}: {
  session: SessionRecord;
  phase: Phase;
  streamingText: string;
  recurring: ReadonlySet<MistakeCategory>;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const turnCount = session.turns.length;
  const lastCorrections = session.turns[turnCount - 1]?.corrections?.length ?? 0;

  // Scroll only the transcript box (scrollIntoView would also scroll the page).
  useEffect(() => {
    const box = endRef.current?.closest<HTMLElement>("[data-scroll-container]");
    if (box) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
  }, [turnCount, streamingText, phase, lastCorrections]);

  const thinking = phase === "starting" || phase === "coach-thinking";

  return (
    <div className="space-y-4" aria-live="polite" aria-relevant="additions">
      {session.turns.map((turn) =>
        turn.role === "coach" ? (
          <div key={turn.id} className="flex max-w-[92%] gap-2.5 sm:max-w-[80%]">
            <span className="mt-5 grid size-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
              <Bot className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-medium text-muted-foreground">{coachLabel(turn)}</p>
              <div className="rounded-2xl rounded-tl-sm border bg-card px-4 py-2.5 text-[15px] leading-relaxed shadow-xs">
                {turn.text}
              </div>
            </div>
          </div>
        ) : (
          <div key={turn.id} className="ml-auto flex max-w-[92%] flex-col items-end gap-2 sm:max-w-[80%]">
            <div className="flex gap-2.5">
              <div className="min-w-0 space-y-1 text-right">
                <p className="text-[11px] font-medium text-muted-foreground">
                  You · {turn.source === "voice" ? "spoken" : "typed"}
                </p>
                <div className="rounded-2xl rounded-tr-sm bg-secondary px-4 py-2.5 text-left text-[15px] leading-relaxed text-secondary-foreground">
                  {turn.text}
                </div>
              </div>
              <span className="mt-5 grid size-7 shrink-0 place-items-center rounded-full bg-highlight text-highlight-foreground">
                <User className="size-4" aria-hidden="true" />
              </span>
            </div>
            <div className="w-full max-w-md pr-9">
              <LearnerCorrections turn={turn} mode={session.mode} recurring={recurring} />
            </div>
          </div>
        ),
      )}

      {thinking && (
        <div className="flex max-w-[92%] gap-2.5 sm:max-w-[80%]">
          <span className="mt-5 grid size-7 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
            <Bot className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground">
              {session.engine === "ollama" ? "Coach · local AI" : "Coach"}
            </p>
            <div className={cn("rounded-2xl rounded-tl-sm border bg-card px-4 py-2.5 text-[15px] leading-relaxed")}>
              {streamingText ? (
                streamingText
              ) : (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TypingDots /> Thinking on your computer…
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {phase === "checking" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Checking your answer before the coach replies…
        </p>
      )}
      <div ref={endRef} />
    </div>
  );
}
