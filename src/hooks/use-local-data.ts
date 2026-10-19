"use client";

import { useCallback, useEffect, useState } from "react";
import { listMistakes, listSessions } from "@/lib/db";
import type { MistakeRecord, SessionRecord } from "@/lib/types";

export interface LocalData {
  sessions: SessionRecord[];
  mistakes: MistakeRecord[];
  loading: boolean;
  error: string | null;
  /** When the data was last loaded (ms). Lets derived views stay pure. */
  loadedAt: number;
  reload: () => void;
}

/** Loads learning history from this browser's IndexedDB. */
export function useLocalData(): LocalData {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [loadedAt, setLoadedAt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([listSessions(), listMistakes()])
      .then(([s, m]) => {
        if (cancelled) return;
        setSessions(s);
        setMistakes(m);
        setLoadedAt(Date.now());
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not read local history.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { sessions, mistakes, loading, error, loadedAt, reload };
}
