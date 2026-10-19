// Browser-side client for the app's own /api/ai/* routes, which talk only to
// the local Ollama server. This module never calls an external AI provider,
// and there is no automatic fallback to one.

import type { ChatMessage } from "./prompts";
import type { OllamaStatus } from "./server/ollama";
import { splitNdjson, type ClientStreamEvent } from "./stream";
import { stripThinking } from "./text";

export const AI_ENDPOINTS = {
  status: "/api/ai/status",
  chat: "/api/ai/chat",
  complete: "/api/ai/complete",
  sarvamStatus: "/api/sarvam/status",
} as const;

export class LocalAiError extends Error {
  constructor(
    message: string,
    readonly kind: "offline" | "model" | "timeout" | "aborted" | "bad-output" | "server",
  ) {
    super(message);
    this.name = "LocalAiError";
  }
}

export type { OllamaStatus };

export async function fetchAiStatus(signal?: AbortSignal): Promise<OllamaStatus> {
  const res = await fetch(AI_ENDPOINTS.status, { cache: "no-store", signal });
  if (!res.ok) throw new LocalAiError(`Status check failed (HTTP ${res.status}).`, "server");
  return (await res.json()) as OllamaStatus;
}

export interface SarvamStatusResponse {
  keyConfigured: boolean;
  enabled: false;
  freeCreditsVerified: false;
  reason: string;
}

export async function fetchSarvamStatus(signal?: AbortSignal): Promise<SarvamStatusResponse> {
  const res = await fetch(AI_ENDPOINTS.sarvamStatus, { cache: "no-store", signal });
  if (!res.ok) throw new LocalAiError(`Status check failed (HTTP ${res.status}).`, "server");
  return (await res.json()) as SarvamStatusResponse;
}

async function errorFrom(res: Response): Promise<LocalAiError> {
  let message = `Local AI error (HTTP ${res.status}).`;
  try {
    const j = (await res.json()) as { error?: string };
    if (j.error) message = j.error;
  } catch {
    /* ignore */
  }
  const kind = res.status === 503 ? "offline" : res.status === 400 ? "model" : "server";
  return new LocalAiError(message, kind);
}

export interface ChatOptions {
  temperature?: number;
  num_predict?: number;
}

/**
 * Stream a reply from the local model. `onToken` receives the full text so
 * far (with any <think> blocks removed).
 */
export async function streamChat(
  req: { model: string; messages: ChatMessage[]; options?: ChatOptions },
  handlers: { onText?: (fullText: string) => void; signal?: AbortSignal } = {},
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(AI_ENDPOINTS.chat, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal: handlers.signal,
    });
  } catch (err) {
    if (handlers.signal?.aborted) throw new LocalAiError("Cancelled.", "aborted");
    throw new LocalAiError(
      `Could not reach the BolBindass server: ${err instanceof Error ? err.message : "network error"}.`,
      "offline",
    );
  }
  if (!res.ok || !res.body) throw await errorFrom(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let raw = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { lines, rest } = splitNdjson(buffer);
      buffer = rest;
      for (const line of lines) {
        const ev = line as ClientStreamEvent;
        if (ev.type === "error") throw new LocalAiError(ev.message, "server");
        if (ev.type === "token") {
          raw += ev.text;
          handlers.onText?.(stripThinking(raw));
        }
      }
    }
  } catch (err) {
    if (handlers.signal?.aborted) throw new LocalAiError("Cancelled.", "aborted");
    if (err instanceof LocalAiError) throw err;
    throw new LocalAiError("The connection to the local AI was interrupted.", "offline");
  }
  const text = stripThinking(raw).trim();
  if (!text) throw new LocalAiError("The local AI returned an empty reply.", "bad-output");
  return text;
}

/** Ask the local model for JSON matching `schema`. Returns the parsed object. */
export async function completeJson<T>(
  req: { model: string; messages: ChatMessage[]; schema: object; options?: ChatOptions },
  opts: { signal?: AbortSignal } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(AI_ENDPOINTS.complete, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: req.model,
        messages: req.messages,
        format: req.schema,
        options: { temperature: 0.1, num_predict: 400, ...req.options },
      }),
      signal: opts.signal,
    });
  } catch {
    if (opts.signal?.aborted) throw new LocalAiError("Cancelled.", "aborted");
    throw new LocalAiError("Could not reach the BolBindass server.", "offline");
  }
  if (!res.ok) throw await errorFrom(res);
  const { content } = (await res.json()) as { content?: string };
  return parseJsonLoose<T>(content ?? "");
}

/** Parse model JSON, tolerating code fences or text around the object. */
export function parseJsonLoose<T>(text: string): T {
  const cleaned = stripThinking(text).replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        /* fall through */
      }
    }
    throw new LocalAiError("The local AI returned something that wasn't valid JSON.", "bad-output");
  }
}
