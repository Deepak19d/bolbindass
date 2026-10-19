// Local-only persistence (IndexedDB in this browser profile). Nothing here
// talks to a server. Raw audio is never stored — only text transcripts.

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { rebuildMemory } from "./mistake-memory";
import { clearSettings, loadSettings } from "./settings";
import type { ExportBundle, MistakeRecord, SessionRecord } from "./types";

export const DB_NAME = "bolbindass";
const DB_VERSION = 1;

interface BolBindassDB extends DBSchema {
  sessions: {
    key: string;
    value: SessionRecord;
    indexes: { startedAt: number };
  };
  mistakes: {
    key: string;
    value: MistakeRecord;
  };
}

let dbPromise: Promise<IDBPDatabase<BolBindassDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<BolBindassDB>> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("This browser does not support local storage (IndexedDB)."));
  }
  dbPromise ??= openDB<BolBindassDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const sessions = db.createObjectStore("sessions", { keyPath: "id" });
      sessions.createIndex("startedAt", "startedAt");
      db.createObjectStore("mistakes", { keyPath: "key" });
    },
  }).catch((err) => {
    dbPromise = null;
    throw err;
  });
  return dbPromise;
}

/** For tests: forget the cached connection. */
export async function resetDbConnection(): Promise<void> {
  if (dbPromise) {
    try {
      (await dbPromise).close();
    } catch {
      /* ignore */
    }
  }
  dbPromise = null;
}

export async function saveSession(session: SessionRecord): Promise<void> {
  const db = await getDb();
  await db.put("sessions", session);
}

export async function getSession(id: string): Promise<SessionRecord | undefined> {
  const db = await getDb();
  return db.get("sessions", id);
}

/** Most recent first. */
export async function listSessions(): Promise<SessionRecord[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("sessions", "startedAt");
  return all.reverse();
}

export async function listMistakes(): Promise<MistakeRecord[]> {
  const db = await getDb();
  return db.getAll("mistakes");
}

export async function replaceMistakes(records: MistakeRecord[]): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("mistakes", "readwrite");
  await tx.store.clear();
  for (const r of records) await tx.store.put(r);
  await tx.done;
}

/** Delete one session and rebuild mistake memory without it. */
export async function deleteSession(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("sessions", id);
  const remaining = await listSessions();
  await replaceMistakes(rebuildMemory(remaining));
}

export async function clearMistakes(): Promise<void> {
  const db = await getDb();
  await db.clear("mistakes");
}

/** Delete ALL learning history (sessions + mistake memory). Settings are kept unless asked. */
export async function deleteAllHistory(options: { includeSettings?: boolean } = {}): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["sessions", "mistakes"], "readwrite");
  await Promise.all([tx.objectStore("sessions").clear(), tx.objectStore("mistakes").clear(), tx.done]);
  if (options.includeSettings) clearSettings();
}

export async function exportAll(now: Date = new Date()): Promise<ExportBundle> {
  const [sessions, mistakes] = await Promise.all([listSessions(), listMistakes()]);
  return {
    app: "bolbindass",
    formatVersion: 1,
    exportedAt: now.toISOString(),
    settings: loadSettings(),
    sessions,
    mistakes,
  };
}

export function exportFileName(now: Date = new Date()): string {
  const d = now.toISOString().slice(0, 10);
  return `bolbindass-history-${d}.json`;
}
