"use client";

import { HelpCircle, Mic, MicOff, Repeat, SendHorizontal, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PracticeSessionApi } from "@/hooks/use-practice-session";
import { canSubmit } from "@/lib/practice-machine";
import { cn } from "@/lib/utils";

export function Composer({ practice }: { practice: PracticeSessionApi }) {
  const { state, recognition, micOn } = practice;
  const phase = state.phase;
  const session = state.session;
  const yourTurn = canSubmit(phase);
  const listening = recognition.listening;
  const isAi = session?.engine === "ollama";

  const send = () => {
    if (practice.draft.trim()) void practice.submit(practice.draft, "typed");
  };

  return (
    <div className="space-y-3">
      {recognition.error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {recognition.error.message}
        </div>
      )}

      <div className="flex items-start gap-3">
        {recognition.supported ? (
          <Button
            type="button"
            size="icon-lg"
            onClick={() => (listening ? recognition.finish() : practice.listenNow())}
            disabled={!yourTurn && !listening}
            aria-label={listening ? "Done speaking — send my answer" : "Start speaking"}
            className={cn("size-14 shrink-0 rounded-full [&_svg:not([class*='size-'])]:size-6", listening && "mic-live")}
          >
            {listening ? <Square /> : <Mic />}
          </Button>
        ) : null}

        <div className="min-w-0 flex-1 space-y-2">
          {listening || recognition.heard ? (
            <div className="min-h-14 rounded-xl border border-primary/40 bg-secondary/50 px-3 py-2 text-[15px]">
              <p className="text-[11px] font-medium text-primary">
                {listening ? "Listening… take your time" : "Heard"}
              </p>
              <p className={cn(!recognition.heard && "text-muted-foreground")}>
                {recognition.heard || "Start speaking. I'll wait until you finish."}
              </p>
            </div>
          ) : (
            <div className="flex gap-2">
              <Textarea
                value={practice.draft}
                onChange={(e) => practice.setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={yourTurn ? "Type your answer (Enter to send)…" : "Wait for the coach…"}
                aria-label="Type your answer"
                disabled={!yourTurn}
                rows={2}
                className="min-h-14 resize-none bg-card text-[15px]"
              />
              <Button
                type="button"
                size="icon-lg"
                onClick={send}
                disabled={!yourTurn || !practice.draft.trim()}
                aria-label="Send"
                className="size-14 shrink-0"
              >
                <SendHorizontal />
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {listening && (
          <Button size="sm" onClick={recognition.finish}>
            Done speaking
          </Button>
        )}
        {listening && (
          <Button size="sm" variant="ghost" onClick={recognition.cancel}>
            Discard
          </Button>
        )}
        {recognition.supported && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (micOn) {
                recognition.cancel();
                practice.setMicOn(false);
              } else {
                recognition.clearError();
                practice.listenNow();
              }
            }}
          >
            {micOn ? <MicOff data-icon="inline-start" /> : <Mic data-icon="inline-start" />}
            {micOn ? "Mute mic" : "Resume mic"}
          </Button>
        )}
        {practice.tts.supported && (
          <Button size="sm" variant="outline" onClick={() => void practice.replayLast()} disabled={phase !== "your-turn"}>
            <Repeat data-icon="inline-start" /> Repeat question
          </Button>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={isAi ? -1 : 0}>
              <Button size="sm" variant="outline" onClick={practice.askSimpler} disabled={!isAi || !yourTurn}>
                <HelpCircle data-icon="inline-start" /> Say it simpler
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {isAi ? "The coach rephrases its last message in simpler words (with a Hindi hint if enabled)." : "Needs the local AI."}
          </TooltipContent>
        </Tooltip>
        {phase === "coach-speaking" && (
          <Button size="sm" variant="ghost" onClick={practice.tts.cancel}>
            Stop reading
          </Button>
        )}
      </div>
      {!recognition.supported && (
        <p className="text-xs text-muted-foreground">
          Voice input isn&apos;t available in this browser — type your answers instead (Chrome or Edge support speaking).
        </p>
      )}
    </div>
  );
}
