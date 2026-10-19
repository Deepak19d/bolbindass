"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAiStatus, type OllamaStatus } from "@/lib/ai-client";

export interface AiStatusState {
  status: OllamaStatus | null;
  loading: boolean;
  /** The BolBindass server itself could not be reached. */
  error: string | null;
  refresh: () => void;
}

/** Checks the local Ollama server via this app's own API. Re-checks on window focus. */
export function useAiStatus(): AiStatusState {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  // Only updates state from async callbacks.
  const load = useCallback((ctrl: AbortController) => {
    fetchAiStatus(ctrl.signal)
      .then((s) => {
        setStatus(s);
        setError(null);
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Could not check the local AI.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
  }, []);

  const refresh = useCallback(() => {
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setLoading(true);
    load(ctrl);
  }, [load]);

  useEffect(() => {
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    load(ctrl);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      ctrlRef.current?.abort();
    };
  }, [load, refresh]);

  return { status, loading, error, refresh };
}
