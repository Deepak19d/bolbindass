import { ALL_TOPIC_CATEGORIES, LEVEL_ORDER } from "./topics";
import type { CorrectionMode, HelpLanguage, Settings, SpeechLang } from "./types";

export const SETTINGS_STORAGE_KEY = "bolbindass:settings:v1";

export const DEFAULT_SETTINGS: Settings = {
  name: "",
  goal: "Speak confidently at work and in job interviews",
  level: "intermediate",
  correctionMode: "friendly",
  helpLanguage: "hinglish",
  interests: ["workplace", "ai-software", "interviews", "projects"],
  model: "",
  speechLang: "en-IN",
  autoSpeak: true,
  voiceURI: "",
  speechRate: 0.95,
  handsFree: true,
  silenceTimeoutMs: 5000,
  reviewBeforeSend: false,
  sessionTargetMinutes: 10,
};

export const CORRECTION_MODES: Record<CorrectionMode, { label: string; description: string }> = {
  friendly: {
    label: "Friendly",
    description: "Finish speaking, get a natural reply, then see one or two important corrections.",
  },
  instant: {
    label: "Instant correction",
    description: "Corrections appear right after each answer, before the coach replies.",
  },
  immersion: {
    label: "Immersion",
    description: "Pure conversation in English. All corrections wait for the end-of-session report.",
  },
};

export const HELP_LANGUAGES: Record<HelpLanguage, string> = {
  english: "Simple English only",
  hinglish: "Simple English, with a short Hindi hint when I'm stuck",
};

export const SPEECH_LANGS: Record<SpeechLang, string> = {
  "en-IN": "English (India)",
  "en-US": "English (US)",
  "en-GB": "English (UK)",
};

export const SILENCE_OPTIONS: { value: number; label: string }[] = [
  { value: 3000, label: "3 seconds" },
  { value: 5000, label: "5 seconds" },
  { value: 8000, label: "8 seconds" },
  { value: 0, label: "Never — I'll press Done" },
];

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

const num = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);

const text = (value: unknown, max: number, fallback: string) =>
  typeof value === "string" ? value.slice(0, max) : fallback;

/** Accept anything (old versions, hand-edited storage) and return valid settings. */
export function sanitizeSettings(input: unknown): Settings {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  const interests = Array.isArray(raw.interests)
    ? raw.interests.filter((i): i is Settings["interests"][number] =>
        (ALL_TOPIC_CATEGORIES as string[]).includes(i as string),
      )
    : d.interests;
  return {
    name: text(raw.name, 40, d.name),
    goal: text(raw.goal, 200, d.goal),
    level: oneOf(raw.level, LEVEL_ORDER, d.level),
    correctionMode: oneOf(raw.correctionMode, ["friendly", "instant", "immersion"] as const, d.correctionMode),
    helpLanguage: oneOf(raw.helpLanguage, ["english", "hinglish"] as const, d.helpLanguage),
    interests: [...new Set(interests)],
    model: text(raw.model, 120, d.model),
    speechLang: oneOf(raw.speechLang, ["en-IN", "en-US", "en-GB"] as const, d.speechLang),
    autoSpeak: bool(raw.autoSpeak, d.autoSpeak),
    voiceURI: text(raw.voiceURI, 300, d.voiceURI),
    speechRate: num(raw.speechRate, 0.6, 1.4, d.speechRate),
    handsFree: bool(raw.handsFree, d.handsFree),
    silenceTimeoutMs: SILENCE_OPTIONS.some((o) => o.value === raw.silenceTimeoutMs)
      ? (raw.silenceTimeoutMs as number)
      : d.silenceTimeoutMs,
    reviewBeforeSend: bool(raw.reviewBeforeSend, d.reviewBeforeSend),
    sessionTargetMinutes: num(raw.sessionTargetMinutes, 3, 60, d.sessionTargetMinutes),
  };
}

export function loadSettings(storage: Storage | undefined = safeLocalStorage()): Settings {
  if (!storage) return DEFAULT_SETTINGS;
  try {
    const raw = storage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? sanitizeSettings(JSON.parse(raw)) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: Settings, storage: Storage | undefined = safeLocalStorage()): Settings {
  const clean = sanitizeSettings(settings);
  storage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(clean));
  return clean;
}

export function clearSettings(storage: Storage | undefined = safeLocalStorage()): void {
  storage?.removeItem(SETTINGS_STORAGE_KEY);
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}
