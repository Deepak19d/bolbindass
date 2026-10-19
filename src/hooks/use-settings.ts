"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  loadSettings,
  saveSettings,
} from "@/lib/settings";
import type { Settings } from "@/lib/types";

const listeners = new Set<() => void>();
let cache: { raw: string | null; value: Settings } | null = null;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function getSnapshot(): Settings {
  const raw = readRaw();
  if (!cache || cache.raw !== raw) cache = { raw, value: loadSettings() };
  return cache.value;
}

function getServerSnapshot(): Settings {
  return DEFAULT_SETTINGS;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SETTINGS_STORAGE_KEY || e.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function notifySettingsChanged(): void {
  for (const l of listeners) l();
}

export function useSettings(): {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  replace: (next: Settings) => void;
} {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const update = useCallback((patch: Partial<Settings>) => {
    saveSettings({ ...getSnapshot(), ...patch });
    notifySettingsChanged();
  }, []);
  const replace = useCallback((next: Settings) => {
    saveSettings(next);
    notifySettingsChanged();
  }, []);
  return { settings, update, replace };
}
