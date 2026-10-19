"use client";

import { Download, KeyRound, Play, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AiSetupHelp } from "@/components/ai-setup-help";
import { ConfirmButton } from "@/components/confirm-button";
import { PageHeader } from "@/components/empty-state";
import { VoiceHowItWorks } from "@/components/practice/practice-setup";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAiStatus } from "@/hooks/use-ai-status";
import { notifySettingsChanged, useSettings } from "@/hooks/use-settings";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import { fetchSarvamStatus, type SarvamStatusResponse } from "@/lib/ai-client";
import { deleteAllHistory } from "@/lib/db";
import { downloadHistoryExport } from "@/lib/download";
import { CORRECTION_MODES, HELP_LANGUAGES, SILENCE_OPTIONS, SPEECH_LANGS } from "@/lib/settings";
import { ALL_TOPIC_CATEGORIES, LEVEL_LABELS, LEVEL_ORDER, TOPIC_CATEGORY_LABELS } from "@/lib/topics";
import type { CorrectionMode, HelpLanguage, LearningLevel, SpeechLang, TopicCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

export function SettingsView() {
  const { settings, update } = useSettings();
  const ai = useAiStatus();
  const tts = useSpeechSynthesis({ voiceURI: settings.voiceURI, rate: settings.speechRate, lang: settings.speechLang });
  const [sarvam, setSarvam] = useState<SarvamStatusResponse | null>(null);
  const [sarvamError, setSarvamError] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetchSarvamStatus(ctrl.signal)
      .then(setSarvam)
      .catch(() => {
        if (!ctrl.signal.aborted) setSarvamError(true);
      });
    return () => ctrl.abort();
  }, []);

  const toggleInterest = (c: TopicCategory) => {
    const has = settings.interests.includes(c);
    update({ interests: has ? settings.interests.filter((i) => i !== c) : [...settings.interests, c] });
  };

  const englishVoices = tts.voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const installed = ai.status?.models ?? [];
  const modelValue = installed.some((m) => m.name === settings.model) ? settings.model : "auto";

  return (
    <div>
      <PageHeader title="Settings" description="Saved automatically in this browser." />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>About you</CardTitle>
            <CardDescription>The coach uses this to pick topics and adjust its language.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Your name (optional)" htmlFor="name">
              <Input id="name" value={settings.name} maxLength={40} onChange={(e) => update({ name: e.target.value })} placeholder="e.g. Deepak" />
            </Field>
            <Field label="Your goal" htmlFor="goal" hint="Mentioning interviews, work or projects helps the topic picker.">
              <Textarea id="goal" value={settings.goal} maxLength={200} rows={2} onChange={(e) => update({ goal: e.target.value })} />
            </Field>
            <Field label="English level" htmlFor="level">
              <Select value={settings.level} onValueChange={(v) => update({ level: v as LearningLevel })}>
                <SelectTrigger id="level" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVEL_ORDER.map((l) => (
                    <SelectItem key={l} value={l}>
                      {LEVEL_LABELS[l]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Topics I enjoy</legend>
              <div className="flex flex-wrap gap-2">
                {ALL_TOPIC_CATEGORIES.map((c) => {
                  const on = settings.interests.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleInterest(c)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
                        on ? "border-primary bg-secondary text-secondary-foreground" : "bg-card text-muted-foreground hover:bg-muted",
                      )}
                    >
                      {TOPIC_CATEGORY_LABELS[c]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Corrections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div role="radiogroup" aria-label="Correction mode" className="space-y-2">
              {(Object.keys(CORRECTION_MODES) as CorrectionMode[]).map((m) => {
                const active = settings.correctionMode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => update({ correctionMode: m })}
                    className={cn(
                      "w-full rounded-xl border p-3 text-left text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none",
                      active ? "border-primary bg-secondary" : "bg-card hover:bg-muted",
                    )}
                  >
                    <span className="block font-semibold">{CORRECTION_MODES[m].label}</span>
                    <span className="block text-xs text-muted-foreground">{CORRECTION_MODES[m].description}</span>
                  </button>
                );
              })}
            </div>
            <Field label="Explanations" htmlFor="help">
              <Select value={settings.helpLanguage} onValueChange={(v) => update({ helpLanguage: v as HelpLanguage })}>
                <SelectTrigger id="help" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(HELP_LANGUAGES) as HelpLanguage[]).map((h) => (
                    <SelectItem key={h} value={h}>
                      {HELP_LANGUAGES[h]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Session length target" htmlFor="target">
              <Select value={String(settings.sessionTargetMinutes)} onValueChange={(v) => update({ sessionTargetMinutes: Number(v) })}>
                <SelectTrigger id="target" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 15, 20, 30].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} minutes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Local AI (Ollama)</CardTitle>
            <CardDescription>Runs on this computer. BolBindass never calls a paid or cloud AI.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              {ai.status?.state === "online" ? (
                <StatusPill tone={installed.length ? "good" : "warn"}>
                  Ollama {ai.status.version ?? ""} · {installed.length} local model{installed.length === 1 ? "" : "s"}
                </StatusPill>
              ) : (
                <StatusPill tone="bad">{ai.loading ? "Checking…" : "Not running"}</StatusPill>
              )}
              <Button variant="outline" size="sm" onClick={ai.refresh} disabled={ai.loading}>
                <RefreshCw data-icon="inline-start" className={ai.loading ? "animate-spin" : undefined} /> Refresh
              </Button>
            </div>
            {installed.length > 0 && (
              <Field label="Model" htmlFor="model" hint="Smaller models answer faster on a laptop CPU.">
                <Select value={modelValue} onValueChange={(v) => update({ model: v === "auto" ? "" : v })}>
                  <SelectTrigger id="model" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automatic ({ai.status?.recommendedModel})</SelectItem>
                    {installed.map((m) => (
                      <SelectItem key={m.name} value={m.name}>
                        {m.name} · {m.parameterSize || "?"} · {(m.sizeBytes / 1e9).toFixed(1)} GB
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            {ai.status && ai.status.cloudModelsHidden.length > 0 && (
              <p className="rounded-lg bg-accent/50 p-3 text-xs">
                Hidden and blocked: <strong>{ai.status.cloudModelsHidden.join(", ")}</strong>. These are Ollama Cloud
                models — they run on ollama.com servers (not your PC), need an online account and can have usage limits
                or charges. To remove one: <code>ollama rm {ai.status.cloudModelsHidden[0]}</code>
              </p>
            )}
            {(ai.status?.state !== "online" || installed.length === 0) && <AiSetupHelp status={ai.status} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Voice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Speech recognition language" htmlFor="lang">
              <Select value={settings.speechLang} onValueChange={(v) => update({ speechLang: v as SpeechLang })}>
                <SelectTrigger id="lang" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SPEECH_LANGS) as SpeechLang[]).map((l) => (
                    <SelectItem key={l} value={l}>
                      {SPEECH_LANGS[l]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <ToggleRow id="hands-free" label="Hands-free" hint="Start listening automatically after the coach speaks." checked={settings.handsFree} onChange={(v) => update({ handsFree: v })} />
            <Field label="Send my answer after a pause of" htmlFor="silence" hint="Longer pauses are kinder when you need time to think.">
              <Select value={String(settings.silenceTimeoutMs)} onValueChange={(v) => update({ silenceTimeoutMs: Number(v) })}>
                <SelectTrigger id="silence" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SILENCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <ToggleRow id="review" label="Review before sending" hint="Put recognised speech in the text box so you can fix recognition errors first." checked={settings.reviewBeforeSend} onChange={(v) => update({ reviewBeforeSend: v })} />
            <ToggleRow id="auto-speak" label="Read the coach's replies aloud" checked={settings.autoSpeak} onChange={(v) => update({ autoSpeak: v })} disabled={!tts.supported} />
            <Field label="Coach voice" htmlFor="voice" hint="“offline” voices run on your PC; “online” voices are streamed by the browser.">
              <Select value={settings.voiceURI || "auto"} onValueChange={(v) => update({ voiceURI: v === "auto" ? "" : v })} disabled={!tts.supported}>
                <SelectTrigger id="voice" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automatic{tts.activeVoice ? ` (${tts.activeVoice.name})` : ""}</SelectItem>
                  {englishVoices.map((v) => (
                    <SelectItem key={v.voiceURI} value={v.voiceURI}>
                      {v.name} · {v.lang} · {v.localService ? "offline" : "online"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={`Speaking speed: ${settings.speechRate.toFixed(2)}×`} htmlFor="rate">
              <input
                id="rate"
                type="range"
                min={0.6}
                max={1.4}
                step={0.05}
                value={settings.speechRate}
                onChange={(e) => update({ speechRate: Number(e.target.value) })}
                className="w-full accent-[var(--primary)]"
              />
            </Field>
            <Button variant="outline" size="sm" disabled={!tts.supported} onClick={() => void tts.speak("Hi! This is how I will sound during your practice. Shall we begin?")}>
              <Play data-icon="inline-start" /> Test voice
            </Button>
            <VoiceHowItWorks support={null} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Privacy & data</CardTitle>
            <CardDescription>
              Transcripts, reports and mistake memory are stored only in this browser (IndexedDB). Raw audio is never stored.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const n = await downloadHistoryExport();
                  toast.success(`Exported ${n} session${n === 1 ? "" : "s"}.`);
                } catch {
                  toast.error("Export failed.");
                }
              }}
            >
              <Download data-icon="inline-start" /> Export my data (JSON)
            </Button>
            <ConfirmButton
              title="Delete all learning history?"
              description="Every session, transcript, report and your mistake memory will be permanently deleted from this browser. Your settings stay."
              confirmLabel="Delete history"
              onConfirm={async () => {
                await deleteAllHistory();
                toast.success("Learning history deleted.");
              }}
            >
              <Trash2 data-icon="inline-start" /> Delete history
            </ConfirmButton>
            <ConfirmButton
              variant="outline"
              title="Reset everything?"
              description="Deletes all history AND resets your settings to the defaults."
              confirmLabel="Reset everything"
              onConfirm={async () => {
                await deleteAllHistory({ includeSettings: true });
                notifySettingsChanged();
                toast.success("Everything was reset.");
              }}
            >
              Reset everything
            </ConfirmButton>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary" aria-hidden="true" /> Optional paid services
            </CardTitle>
            <CardDescription>Not needed. Everything above works without any API key.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <StatusPill tone="idle">Sarvam AI: switched off</StatusPill>
              {sarvam && (
                <StatusPill tone={sarvam.keyConfigured ? "warn" : "idle"}>
                  Key {sarvam.keyConfigured ? "detected (never used)" : "not configured"}
                </StatusPill>
              )}
            </div>
            <p className="text-muted-foreground">
              {sarvamError ? "Could not check Sarvam configuration." : sarvam?.reason ?? "Checking…"}
            </p>
            <p className="text-xs text-muted-foreground">
              Sarvam&apos;s docs list a one-time ₹100 credit for new accounts, then pay-per-use (for example ₹30 per hour of
              speech-to-text). BolBindass has no Sarvam integration enabled, so it can never create a bill.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
