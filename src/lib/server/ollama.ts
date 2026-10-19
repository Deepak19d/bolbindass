// Server-side helpers for talking to a LOCAL Ollama server.
//
// Zero-cost guarantees enforced here:
//  • Only loopback addresses (127.0.0.1 / localhost / ::1) are accepted.
//  • Ollama "cloud" models (e.g. "gemma4:31b-cloud") run on ollama.com, not on
//    this PC, and may hit usage limits or charges — they are hidden and refused.
//  • Only models that are actually installed locally can be used.
//  • There is no fallback to any external AI provider.

import type { ChatMessage } from "../prompts";

export const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

export type UrlResolution =
  | { ok: true; url: string }
  | { ok: false; reason: string };

type Env = Record<string, string | undefined>;

/**
 * BolBindass uses its own variable (BOLBINDASS_OLLAMA_URL) instead of
 * OLLAMA_HOST, because OLLAMA_HOST configures the Ollama server's own bind
 * address and is often "0.0.0.0".
 */
export function resolveOllamaUrl(env: Env = process.env): UrlResolution {
  const raw = (env.BOLBINDASS_OLLAMA_URL ?? "").trim();
  if (!raw) return { ok: true, url: DEFAULT_OLLAMA_URL };
  let parsed: URL;
  try {
    parsed = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `http://${raw}`);
  } catch {
    return { ok: false, reason: `BOLBINDASS_OLLAMA_URL is not a valid URL.` };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, reason: "BOLBINDASS_OLLAMA_URL must use http:// or https://." };
  }
  let host = parsed.hostname.toLowerCase();
  if (host === "0.0.0.0") host = "127.0.0.1";
  if (!LOOPBACK.has(host)) {
    return {
      ok: false,
      reason:
        "Only a local Ollama server (127.0.0.1, localhost or ::1) is allowed. Remote AI servers are blocked so your practice stays private and free.",
    };
  }
  const port = parsed.port ? `:${parsed.port}` : "";
  return { ok: true, url: `${parsed.protocol}//${host}${port}` };
}

export interface OllamaTagModel {
  name?: string;
  model?: string;
  size?: number;
  remote_host?: string;
  remote_model?: string;
  details?: {
    family?: string;
    families?: string[] | null;
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface LocalModel {
  name: string;
  sizeBytes: number;
  family: string;
  parameterSize: string;
  quantization: string;
}

export function isCloudModel(m: OllamaTagModel): boolean {
  const name = (m.name ?? m.model ?? "").toLowerCase();
  if (m.remote_host || m.remote_model) return true;
  return /(^|[:\-])cloud($|[:\-])/.test(name);
}

function isEmbeddingModel(m: OllamaTagModel): boolean {
  const name = (m.name ?? m.model ?? "").toLowerCase();
  const fam = (m.details?.family ?? "").toLowerCase();
  return /embed|minilm/.test(name) || fam === "bert" || fam === "nomic-bert";
}

export function partitionModels(models: OllamaTagModel[] | undefined): {
  local: LocalModel[];
  cloudHidden: string[];
} {
  const local: LocalModel[] = [];
  const cloudHidden: string[] = [];
  for (const m of models ?? []) {
    const name = m.name ?? m.model;
    if (!name) continue;
    if (isCloudModel(m)) {
      cloudHidden.push(name);
      continue;
    }
    if (isEmbeddingModel(m)) continue;
    local.push({
      name,
      sizeBytes: typeof m.size === "number" ? m.size : 0,
      family: m.details?.family ?? "",
      parameterSize: m.details?.parameter_size ?? "",
      quantization: m.details?.quantization_level ?? "",
    });
  }
  local.sort((a, b) => a.sizeBytes - b.sizeBytes);
  return { local, cloudHidden };
}

/** Small models that run acceptably on a CPU-only laptop, best first. */
export const PREFERRED_MODELS = [
  "llama3.2:3b",
  "llama3.2:latest",
  "qwen2.5:3b",
  "gemma3:4b",
  "qwen3:4b",
  "phi3:mini",
  "phi4-mini:latest",
  "llama3.2:1b",
  "qwen2.5:1.5b",
  "gemma3:1b",
];

export function pickModel(
  local: LocalModel[],
  requested?: string | null,
  envDefault?: string | null,
): string | null {
  const has = (n?: string | null) => Boolean(n) && local.some((m) => m.name === n);
  if (has(requested)) return requested!;
  if (has(envDefault)) return envDefault!;
  for (const p of PREFERRED_MODELS) if (has(p)) return p;
  return local[0]?.name ?? null;
}

export type OllamaState = "online" | "offline" | "blocked" | "error";

export interface OllamaStatus {
  state: OllamaState;
  url: string | null;
  version: string | null;
  models: LocalModel[];
  cloudModelsHidden: string[];
  recommendedModel: string | null;
  message: string;
  checkedAt: number;
}

async function fetchJson(
  fetchImpl: typeof fetch,
  url: string,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { signal: ctrl.signal, cache: "no-store" });
    const json = res.ok ? await res.json().catch(() => null) : null;
    return { ok: res.ok, status: res.status, json };
  } finally {
    clearTimeout(timer);
  }
}

export async function getOllamaStatus(
  opts: { fetchImpl?: typeof fetch; env?: Env; timeoutMs?: number; now?: number } = {},
): Promise<OllamaStatus> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const env = opts.env ?? process.env;
  const now = opts.now ?? Date.now();
  const resolved = resolveOllamaUrl(env);
  const base: Omit<OllamaStatus, "state" | "message"> = {
    url: resolved.ok ? resolved.url : null,
    version: null,
    models: [],
    cloudModelsHidden: [],
    recommendedModel: null,
    checkedAt: now,
  };
  if (!resolved.ok) return { ...base, state: "blocked", message: resolved.reason };

  try {
    const version = await fetchJson(fetchImpl, `${resolved.url}/api/version`, opts.timeoutMs ?? 2500);
    if (!version.ok) {
      return { ...base, state: "error", message: `Ollama answered with HTTP ${version.status}.` };
    }
    const tags = await fetchJson(fetchImpl, `${resolved.url}/api/tags`, opts.timeoutMs ?? 2500);
    const { local, cloudHidden } = partitionModels(
      (tags.json as { models?: OllamaTagModel[] } | null)?.models,
    );
    const recommended = pickModel(local, null, env.BOLBINDASS_OLLAMA_MODEL);
    return {
      ...base,
      state: "online",
      version: (version.json as { version?: string } | null)?.version ?? null,
      models: local,
      cloudModelsHidden: cloudHidden,
      recommendedModel: recommended,
      message:
        local.length > 0
          ? `Local AI is ready (${local.length} local model${local.length === 1 ? "" : "s"}).`
          : "Ollama is running, but no local chat model is installed yet.",
    };
  } catch {
    return {
      ...base,
      state: "offline",
      message: `Ollama is not running at ${resolved.url}. Start the Ollama app (or run "ollama serve") and try again.`,
    };
  }
}

// ── Request validation ─────────────────────────────────────────────────────

export interface ChatRequestBody {
  model: string;
  messages: ChatMessage[];
  options: { temperature: number; num_predict: number };
  format?: Record<string, unknown>;
}

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

const MAX_MESSAGES = 40;
const MAX_CONTENT = 6000;
const MAX_TOTAL = 40_000;

export function validateChatBody(body: unknown): Validation<ChatRequestBody> {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid request body." };
  const b = body as Record<string, unknown>;
  const model = typeof b.model === "string" ? b.model.trim() : "";
  if (!model || model.length > 120) return { ok: false, error: "A local model name is required." };
  if (isCloudModel({ name: model })) {
    return { ok: false, error: "Cloud models are blocked. BolBindass only uses models running on this computer." };
  }
  if (!Array.isArray(b.messages) || b.messages.length === 0 || b.messages.length > MAX_MESSAGES) {
    return { ok: false, error: "Invalid messages." };
  }
  const messages: ChatMessage[] = [];
  let total = 0;
  for (const m of b.messages) {
    const role = (m as Record<string, unknown>)?.role;
    const content = (m as Record<string, unknown>)?.content;
    if ((role !== "system" && role !== "user" && role !== "assistant") || typeof content !== "string") {
      return { ok: false, error: "Invalid message." };
    }
    if (content.length > MAX_CONTENT) return { ok: false, error: "A message is too long." };
    total += content.length;
    messages.push({ role, content });
  }
  if (total > MAX_TOTAL) return { ok: false, error: "The conversation is too long." };

  const opts = (b.options && typeof b.options === "object" ? b.options : {}) as Record<string, unknown>;
  const clamp = (v: unknown, min: number, max: number, d: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : d;
  let format: Record<string, unknown> | undefined;
  if (b.format !== undefined) {
    if (!b.format || typeof b.format !== "object" || JSON.stringify(b.format).length > 8000) {
      return { ok: false, error: "Invalid format schema." };
    }
    format = b.format as Record<string, unknown>;
  }
  return {
    ok: true,
    value: {
      model,
      messages,
      options: {
        temperature: clamp(opts.temperature, 0, 1.5, 0.7),
        num_predict: Math.round(clamp(opts.num_predict, 16, 1024, 200)),
      },
      format,
    },
  };
}

let installedCache: { url: string; at: number; names: Set<string> } | null = null;

/** Confirms the model is installed locally (and is not a cloud model). Cached briefly. */
export async function isInstalledLocalModel(
  model: string,
  url: string,
  fetchImpl: typeof fetch = fetch,
  now = Date.now(),
): Promise<boolean> {
  if (!installedCache || installedCache.url !== url || now - installedCache.at > 15_000) {
    const tags = await fetchJson(fetchImpl, `${url}/api/tags`, 3000);
    const { local } = partitionModels((tags.json as { models?: OllamaTagModel[] } | null)?.models);
    installedCache = { url, at: now, names: new Set(local.map((m) => m.name)) };
  }
  return installedCache.names.has(model);
}

export function resetInstalledCache(): void {
  installedCache = null;
}

/** Build the exact body sent to the local Ollama /api/chat endpoint. */
export function ollamaChatPayload(body: ChatRequestBody, stream: boolean): Record<string, unknown> {
  return {
    model: body.model,
    messages: body.messages,
    stream,
    format: body.format,
    // Keep the model in memory between turns so replies stay fast.
    keep_alive: "15m",
    // Reasoning ("thinking") output is slow on CPU and not needed here.
    think: false,
    options: { ...body.options, num_ctx: 4096 },
  };
}

/**
 * Reject cross-site requests: another website open in the browser must not
 * be able to drive the local AI through this app.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin fetches from older browsers / server tools
  try {
    const o = new URL(origin);
    const host = request.headers.get("host");
    return host !== null && o.host === host;
  } catch {
    return false;
  }
}
