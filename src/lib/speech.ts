// Browser speech helpers (Web Speech API). No audio is recorded or stored by
// BolBindass. Note: in Chrome and Edge, speech RECOGNITION is processed by the
// browser vendor's online speech service (free, but it needs internet and the
// audio leaves this computer). Speech OUTPUT can use offline system voices.

import { cleanForSpeech } from "./text";

// Minimal typings — the Web Speech recognition API is not in TypeScript's DOM lib.
export interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
export interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}
export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
export interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechWindow {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
  speechSynthesis?: unknown;
  SpeechSynthesisUtterance?: unknown;
  isSecureContext?: boolean;
  navigator?: { userAgent?: string };
}

export interface SpeechSupport {
  recognition: boolean;
  synthesis: boolean;
  secureContext: boolean;
  browser: "chrome" | "edge" | "firefox" | "safari" | "brave" | "other";
  /** Recognition goes through an online vendor service (Chrome/Edge/Safari). */
  recognitionIsCloud: boolean;
}

export function getRecognitionCtor(win: SpeechWindow | undefined): SpeechRecognitionCtor | null {
  if (!win) return null;
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

export function detectBrowser(ua: string): SpeechSupport["browser"] {
  if (/Edg\//.test(ua)) return "edge";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Brave/i.test(ua)) return "brave";
  if (/Chrome\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "other";
}

export function detectSpeechSupport(win: SpeechWindow | undefined): SpeechSupport {
  const browser = detectBrowser(win?.navigator?.userAgent ?? "");
  const recognition = Boolean(getRecognitionCtor(win));
  return {
    recognition,
    synthesis: Boolean(win?.speechSynthesis && win?.SpeechSynthesisUtterance),
    secureContext: win?.isSecureContext !== false,
    browser,
    recognitionIsCloud: recognition && browser !== "other",
  };
}

export interface SpeechErrorInfo {
  code: string;
  message: string;
  /** Stop trying to listen until the learner acts. */
  fatal: boolean;
  /** Microphone permission problem. */
  permission: boolean;
}

export function mapRecognitionError(code: string): SpeechErrorInfo {
  switch (code) {
    case "not-allowed":
      return {
        code,
        fatal: true,
        permission: true,
        message:
          "Microphone access is blocked. Click the lock/site icon in the address bar → Site settings → Microphone → Allow, then press Resume. You can keep practising by typing.",
      };
    case "service-not-allowed":
      return {
        code,
        fatal: true,
        permission: true,
        message:
          "This browser doesn't allow its speech-recognition service here (common in Brave or with strict privacy settings). Use Chrome or Edge for voice, or type your answers.",
      };
    case "audio-capture":
      return {
        code,
        fatal: true,
        permission: false,
        message: "No microphone was found. Plug in or enable a microphone, then press Resume — or type your answers.",
      };
    case "network":
      return {
        code,
        fatal: true,
        permission: false,
        message:
          "Speech recognition needs an internet connection in this browser (it uses the browser's online speech service). You can type your answers while offline.",
      };
    case "language-not-supported":
      return {
        code,
        fatal: true,
        permission: false,
        message: "This speech language isn't supported here. Choose another English variant in Settings.",
      };
    case "no-speech":
      return { code, fatal: false, permission: false, message: "I didn't hear anything. Speak a little louder or closer to the mic." };
    case "aborted":
      return { code, fatal: false, permission: false, message: "" };
    default:
      return { code, fatal: false, permission: false, message: `Speech recognition problem (${code}).` };
  }
}

/** Combine finalised recognition results with the current interim text. */
export function readRecognitionEvent(e: SpeechRecognitionEventLike): { finalText: string; interim: string } {
  let finalText = "";
  let interim = "";
  for (let i = e.resultIndex; i < e.results.length; i += 1) {
    const r = e.results[i];
    const t = r[0]?.transcript ?? "";
    if (r.isFinal) finalText += t;
    else interim += t;
  }
  return { finalText: finalText.trim(), interim: interim.trim() };
}

export function joinSpeech(a: string, b: string): string {
  return [a.trim(), b.trim()].filter(Boolean).join(" ");
}

// ── Speech synthesis ───────────────────────────────────────────────────────

export interface VoiceLike {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  default?: boolean;
}

/**
 * Pick a voice: the learner's choice if available, otherwise prefer an
 * offline (local) voice in the chosen English variant, then any English voice.
 */
export function pickVoice<T extends VoiceLike>(voices: T[], preferredURI: string, lang: string): T | null {
  if (voices.length === 0) return null;
  const chosen = preferredURI ? voices.find((v) => v.voiceURI === preferredURI) : undefined;
  if (chosen) return chosen;
  const english = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const exact = english.filter((v) => v.lang.toLowerCase().replace("_", "-") === lang.toLowerCase());
  const score = (v: T) => (v.localService ? 2 : 0) + (v.default ? 1 : 0);
  const best = (list: T[]) => [...list].sort((a, b) => score(b) - score(a))[0];
  return best(exact) ?? best(english) ?? voices[0];
}

/**
 * Split text into short chunks: Chrome stops speaking long utterances after
 * ~15 seconds, so each sentence is queued separately.
 */
export function splitForSpeech(text: string, maxLen = 180): string[] {
  const clean = cleanForSpeech(text);
  if (!clean) return [];
  const sentences = clean.match(/[^.!?]+[.!?]*\s*/g) ?? [clean];
  const chunks: string[] = [];
  for (const s of sentences) {
    const t = s.trim();
    if (!t) continue;
    if (t.length <= maxLen) {
      chunks.push(t);
      continue;
    }
    let current = "";
    for (const part of t.split(/(?<=,)\s+|\s+/)) {
      if ((current + " " + part).trim().length > maxLen && current) {
        chunks.push(current.trim());
        current = part;
      } else {
        current = `${current} ${part}`;
      }
    }
    if (current.trim()) chunks.push(current.trim());
  }
  return chunks;
}
