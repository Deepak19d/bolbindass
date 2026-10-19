"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { pickVoice, splitForSpeech } from "@/lib/speech";

export interface SpeechSynthesisOptions {
  voiceURI: string;
  rate: number;
  lang: string;
}

export interface SpeechSynthesisControls {
  supported: boolean;
  voices: SpeechSynthesisVoice[];
  speaking: boolean;
  /** Resolves when finished or cancelled. */
  speak: (text: string) => Promise<void>;
  cancel: () => void;
  activeVoice: SpeechSynthesisVoice | null;
}

const noopSubscribe = () => () => {};

function subscribeVoices(cb: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) return () => {};
  window.speechSynthesis.addEventListener?.("voiceschanged", cb);
  return () => window.speechSynthesis.removeEventListener?.("voiceschanged", cb);
}

let voicesCache: SpeechSynthesisVoice[] = [];
function getVoices(): SpeechSynthesisVoice[] {
  const v = window.speechSynthesis?.getVoices?.() ?? [];
  if (v.length !== voicesCache.length || v.some((x, i) => x !== voicesCache[i])) voicesCache = v;
  return voicesCache;
}
const emptyVoices: SpeechSynthesisVoice[] = [];

export function useSpeechSynthesis(options: SpeechSynthesisOptions): SpeechSynthesisControls {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance),
    () => false,
  );
  const voices = useSyncExternalStore(subscribeVoices, getVoices, () => emptyVoices);
  const [speaking, setSpeaking] = useState(false);
  const resolveRef = useRef<(() => void) | null>(null);
  const guardRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeVoice = pickVoice(voices, options.voiceURI, options.lang);

  const settle = useCallback(() => {
    if (guardRef.current) clearTimeout(guardRef.current);
    guardRef.current = null;
    setSpeaking(false);
    const r = resolveRef.current;
    resolveRef.current = null;
    r?.();
  }, []);

  const cancel = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
    settle();
  }, [settle]);

  const speak = useCallback(
    (text: string) => {
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return Promise.resolve();
      cancel();
      const chunks = splitForSpeech(text);
      if (chunks.length === 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        resolveRef.current = resolve;
        setSpeaking(true);
        chunks.forEach((chunk, i) => {
          const u = new SpeechSynthesisUtterance(chunk);
          if (activeVoice) u.voice = activeVoice;
          u.lang = activeVoice?.lang ?? options.lang;
          u.rate = options.rate;
          if (i === chunks.length - 1) u.onend = settle;
          u.onerror = settle;
          window.speechSynthesis.speak(u);
        });
        // Some browsers occasionally never fire `onend`; don't get stuck.
        const estimateMs = Math.max(4000, (text.length * 110) / options.rate + 3000);
        guardRef.current = setTimeout(settle, estimateMs);
      });
    },
    [activeVoice, cancel, options.lang, options.rate, settle],
  );

  // Stop talking when the page is hidden/unmounted.
  useEffect(() => cancel, [cancel]);

  return { supported, voices, speaking, speak, cancel, activeVoice };
}
