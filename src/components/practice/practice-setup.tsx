"use client";

import { Cpu, Loader2, MessageCircleQuestion, Mic, RefreshCw, Shuffle, Sparkles, Volume2 } from "lucide-react";
import { AiSetupHelp } from "@/components/ai-setup-help";
import { StatusPill } from "@/components/status-pill";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { AiStatusState } from "@/hooks/use-ai-status";
import { categoryLabel } from "@/lib/categories";
import type { EngineDecision } from "@/lib/engine";
import { CORRECTION_MODES } from "@/lib/settings";
import type { SpeechSupport } from "@/lib/speech";
import type { TopicChoice } from "@/lib/topic-selector";
import { ALL_TOPIC_CATEGORIES, TOPIC_CATEGORY_LABELS, TOPICS } from "@/lib/topics";
import type { CorrectionMode, Settings } from "@/lib/types";
import { cn } from "@/lib/utils";

export function VoiceHowItWorks({ support }: { support: SpeechSupport | null }) {
  return (
    <div className="space-y-2 text-sm text-muted-foreground">
      <p>
        <span className="font-medium text-foreground">This is not a real-time voice AI.</span> It works in turns: you speak
        → your browser turns speech into text → the local AI replies in text → your browser reads the reply aloud.
      </p>
      <p>
        The AI conversation runs on your computer. Speech <em>recognition</em> in Chrome and Edge is done by the
        browser&apos;s own online speech service (free, but it needs internet and your audio is processed by
        Google/Microsoft). BolBindass never records or stores audio. Typing works everywhere, even offline.
      </p>
      {support && !support.recognition && (
        <p className="text-destructive">
          Voice input isn&apos;t supported in this browser{support.browser === "firefox" ? " (Firefox)" : ""}. Use Chrome or
          Edge for speaking — or type your answers.
        </p>
      )}
    </div>
  );
}

interface PracticeSetupProps {
  settings: Settings;
  onModeChange: (mode: CorrectionMode) => void;
  onModelChange: (model: string) => void;
  ai: AiStatusState;
  decision: EngineDecision;
  basicChosen: boolean;
  onChooseBasic: (basic: boolean) => void;
  choice: TopicChoice | null;
  loadingTopic: boolean;
  onShuffle: () => void;
  onPickTopic: (topicId: string) => void;
  onStart: () => void;
  speech: SpeechSupport | null;
  error: string | null;
}

export function PracticeSetup(props: PracticeSetupProps) {
  const { settings, ai, decision, choice, speech } = props;
  const canStart = Boolean(choice) && (decision.engine === "ollama" || decision.engine === "basic");

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-5">
        {props.error && (
          <Alert variant="destructive">
            <AlertTitle>Couldn&apos;t start the conversation</AlertTitle>
            <AlertDescription>{props.error}</AlertDescription>
          </Alert>
        )}

        <Card className="paper">
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-highlight" aria-hidden="true" /> Today&apos;s topic, picked for you
            </CardDescription>
            {props.loadingTopic || !choice ? (
              <div className="space-y-2 pt-1">
                <Skeleton className="h-7 w-2/3" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : (
              <>
                <CardTitle className="font-heading text-2xl font-semibold">{choice.topic.title}</CardTitle>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Badge variant="secondary">{TOPIC_CATEGORY_LABELS[choice.topic.category]}</Badge>
                  {choice.focusCategories.map((c) => (
                    <Badge key={c} className="bg-accent text-accent-foreground">
                      Practises: {categoryLabel(c).toLowerCase()}
                    </Badge>
                  ))}
                </div>
                <p className="pt-1 text-sm text-muted-foreground">{choice.reason}</p>
              </>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button size="lg" className="h-11 px-5 text-base" disabled={!canStart} onClick={props.onStart}>
                <MessageCircleQuestion data-icon="inline-start" />
                {decision.engine === "basic" ? "Start basic practice" : "Start conversation"}
              </Button>
              <Button size="lg" variant="outline" className="h-11" onClick={props.onShuffle} disabled={!choice}>
                <Shuffle data-icon="inline-start" /> Another topic
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="topic-pick">Or choose a topic yourself</Label>
              <Select value={choice?.topic.id ?? ""} onValueChange={props.onPickTopic}>
                <SelectTrigger id="topic-pick" className="w-full sm:w-96">
                  <SelectValue placeholder="Choose a topic" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_TOPIC_CATEGORIES.map((cat) => (
                    <SelectGroup key={cat}>
                      <SelectLabel>{TOPIC_CATEGORY_LABELS[cat]}</SelectLabel>
                      {TOPICS.filter((t) => t.category === cat).map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.title}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How should I correct you?</CardTitle>
            <CardDescription>You can change this any time in Settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <div role="radiogroup" aria-label="Correction mode" className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(CORRECTION_MODES) as CorrectionMode[]).map((m) => {
                const active = settings.correctionMode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => props.onModeChange(m)}
                    className={cn(
                      "rounded-xl border p-3 text-left text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
                      active ? "border-primary bg-secondary" : "border-border bg-card hover:bg-muted",
                    )}
                  >
                    <span className="block font-semibold">{CORRECTION_MODES[m].label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{CORRECTION_MODES[m].description}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="size-4 text-primary" aria-hidden="true" /> Conversation engine
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {ai.loading && !ai.status ? (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Checking for a local AI…
              </p>
            ) : props.basicChosen ? (
              <>
                <StatusPill tone="warn">Basic practice mode — not AI</StatusPill>
                <p className="text-muted-foreground">
                  Scripted questions from a question bank, with corrections from built-in grammar rules. Useful
                  practice, but it doesn&apos;t understand your answers like the AI does.
                </p>
                {ai.status?.state === "online" && ai.status.models.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => props.onChooseBasic(false)}>
                    Use the local AI instead
                  </Button>
                )}
              </>
            ) : decision.engine === "ollama" ? (
              <>
                <StatusPill tone="good">Local AI ready · runs on this computer</StatusPill>
                <div className="space-y-1.5">
                  <Label htmlFor="model-pick">Model</Label>
                  <Select value={decision.model} onValueChange={props.onModelChange}>
                    <SelectTrigger id="model-pick" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ai.status?.models.map((m) => (
                        <SelectItem key={m.name} value={m.name}>
                          {m.name}
                          {m.sizeBytes ? ` · ${(m.sizeBytes / 1e9).toFixed(1)} GB` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {ai.status && ai.status.cloudModelsHidden.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Hidden: {ai.status.cloudModelsHidden.join(", ")} — cloud models run on ollama.com, not on your PC,
                    so BolBindass never uses them.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  On a laptop CPU, replies can take a few seconds. Slower, but always free and private.
                </p>
              </>
            ) : (
              <>
                <StatusPill tone="bad">Local AI not available</StatusPill>
                <p>{decision.engine === "unavailable" ? decision.reason : ""}</p>
                {ai.error && <p className="text-destructive">{ai.error}</p>}
                <AiSetupHelp status={ai.status} />
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={ai.refresh} disabled={ai.loading}>
                    <RefreshCw data-icon="inline-start" className={ai.loading ? "animate-spin" : undefined} /> Check again
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => props.onChooseBasic(true)}>
                    Practise in Basic mode (no AI)
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="size-4 text-primary" aria-hidden="true" /> Voice
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {speech === null ? (
                <StatusPill tone="idle">Checking browser…</StatusPill>
              ) : (
                <>
                  <StatusPill tone={speech.recognition ? "good" : "bad"}>
                    <Mic className="inline size-3" aria-hidden="true" /> Speech input {speech.recognition ? "supported" : "not supported"}
                  </StatusPill>
                  <StatusPill tone={speech.synthesis ? "good" : "bad"}>
                    <Volume2 className="inline size-3" aria-hidden="true" /> Read aloud {speech.synthesis ? "supported" : "not supported"}
                  </StatusPill>
                </>
              )}
            </div>
            <VoiceHowItWorks support={speech} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
