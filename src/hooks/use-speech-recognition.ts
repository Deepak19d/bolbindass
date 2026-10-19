"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  getRecognitionCtor,
  joinSpeech,
  mapRecognitionError,
  readRecognitionEvent,
  type SpeechErrorInfo,
  type SpeechRecognitionLike,
} from "@/lib/speech";

export interface SpeechRecognitionOptions {
  lang: string;
  /** Auto-finish after this much silence (ms). 0 = only when finish() is called. */
  silenceTimeoutMs: number;
  /** Receives everything said since start(), once the learner is done. */
  onUtterance: (text: string) => void;
}

export interface SpeechRecognitionControls {
  supported: boolean;
  listening: boolean;
  /** Live text heard so far (final + interim). */
  heard: string;
  error: SpeechErrorInfo | null;
  start: () => void;
  /** Stop listening and send what was heard. */
  finish: () => void;
  /** Stop listening and discard what was heard. */
  cancel: () => void;
  clearError: () => void;
}

const MAX_RESTARTS_PER_MINUTE = 8;
const noopSubscribe = () => () => {};

export function useSpeechRecognition(options: SpeechRecognitionOptions): SpeechRecognitionControls {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => Boolean(getRecognitionCtor(window as never)),
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [error, setError] = useState<SpeechErrorInfo | null>(null);

  const optsRef = useRef(options);
  useEffect(() => {
    optsRef.current = options;
  });

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantRef = useRef(false);
  const submitOnEndRef = useRef(false);
  const bufferRef = useRef("");
  const interimRef = useRef("");
  const silenceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartsRef = useRef<number[]>([]);
  // Lets the recogniser's onend handler restart it without a self-reference.
  const restartRef = useRef<() => void>(() => {});

  const clearSilence = () => {
    if (silenceRef.current) clearTimeout(silenceRef.current);
    silenceRef.current = null;
  };

  const resetBuffers = () => {
    bufferRef.current = "";
    interimRef.current = "";
    setHeard("");
  };

  const deliver = useCallback(() => {
    const text = joinSpeech(bufferRef.current, interimRef.current);
    resetBuffers();
    if (text) optsRef.current.onUtterance(text);
  }, []);

  const finish = useCallback(() => {
    clearSilence();
    wantRef.current = false;
    const rec = recRef.current;
    if (rec) {
      submitOnEndRef.current = true;
      try {
        rec.stop(); // onend will deliver the text (after any last final result)
      } catch {
        submitOnEndRef.current = false;
        recRef.current = null;
        setListening(false);
        deliver();
      }
    } else {
      deliver();
    }
  }, [deliver]);

  const armSilenceTimer = useCallback(() => {
    clearSilence();
    const ms = optsRef.current.silenceTimeoutMs;
    if (ms > 0 && joinSpeech(bufferRef.current, interimRef.current)) {
      silenceRef.current = setTimeout(finish, ms);
    }
  }, [finish]);

  const startRecognizer = useCallback(() => {
    const Ctor = getRecognitionCtor(window as never);
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = optsRef.current.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onresult = (e) => {
      const { finalText, interim } = readRecognitionEvent(e);
      if (finalText) bufferRef.current = joinSpeech(bufferRef.current, finalText);
      interimRef.current = interim;
      setHeard(joinSpeech(bufferRef.current, interim));
      armSilenceTimer();
    };
    rec.onerror = (e) => {
      const info = mapRecognitionError(e.error);
      if (info.fatal) {
        wantRef.current = false;
        submitOnEndRef.current = false;
        clearSilence();
        setError(info);
      }
    };
    rec.onend = () => {
      if (recRef.current === rec) recRef.current = null;
      setListening(false);
      if (submitOnEndRef.current) {
        submitOnEndRef.current = false;
        deliver();
        return;
      }
      if (wantRef.current) {
        // Chrome ends recognition after a pause or ~60s; restart quietly.
        const now = Date.now();
        restartsRef.current = restartsRef.current.filter((t) => now - t < 60_000);
        if (restartsRef.current.length >= MAX_RESTARTS_PER_MINUTE) {
          wantRef.current = false;
          setError({
            code: "restart-limit",
            fatal: true,
            permission: false,
            message: "Speech recognition keeps stopping. Press Resume to try again, or type your answer.",
          });
          return;
        }
        restartsRef.current.push(now);
        restartRef.current();
      }
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      // start() throws if a previous session is still closing; retry shortly.
      setTimeout(() => {
        if (wantRef.current && recRef.current === rec) {
          try {
            rec.start();
          } catch {
            /* give up silently; onend/onerror will report */
          }
        }
      }, 250);
    }
  }, [armSilenceTimer, deliver]);

  useEffect(() => {
    restartRef.current = startRecognizer;
  }, [startRecognizer]);

  const start = useCallback(() => {
    if (!getRecognitionCtor(window as never) || wantRef.current) return;
    setError(null);
    resetBuffers();
    wantRef.current = true;
    submitOnEndRef.current = false;
    restartsRef.current = [];
    startRecognizer();
  }, [startRecognizer]);

  const cancel = useCallback(() => {
    clearSilence();
    wantRef.current = false;
    submitOnEndRef.current = false;
    const rec = recRef.current;
    recRef.current = null;
    if (rec) {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    }
    setListening(false);
    resetBuffers();
  }, []);

  // Stop the microphone when the component is hidden/unmounted.
  useEffect(() => cancel, [cancel]);

  const clearError = useCallback(() => setError(null), []);

  return { supported, listening, heard, error, start, finish, cancel, clearError };
}
