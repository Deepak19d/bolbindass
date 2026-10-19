// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_OLLAMA_URL,
  getOllamaStatus,
  isCloudModel,
  isInstalledLocalModel,
  isSameOrigin,
  ollamaChatPayload,
  partitionModels,
  pickModel,
  resetInstalledCache,
  resolveOllamaUrl,
  validateChatBody,
} from "./ollama";
import { getSarvamStatus } from "./sarvam";

// The real /api/tags response from this machine (Ollama 0.34.2).
const TAGS = {
  models: [
    { name: "llama3.2:3b", size: 2019393189, details: { family: "llama", parameter_size: "3.2B", quantization_level: "Q4_K_M" } },
    { name: "gemma4:31b-cloud", size: 312, remote_host: "https://ollama.com", remote_model: "gemma4:31b", details: { parameter_size: "32.7B" } },
    { name: "nomic-embed-text:latest", size: 274_000_000, details: { family: "nomic-bert" } },
  ],
};

function fakeFetch(map: Record<string, unknown>, calls: string[] = []) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    for (const [suffix, body] of Object.entries(map)) {
      if (url.endsWith(suffix)) return new Response(JSON.stringify(body), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
}

afterEach(() => resetInstalledCache());

describe("resolveOllamaUrl — local only", () => {
  it("defaults to 127.0.0.1:11434", () => {
    expect(resolveOllamaUrl({})).toEqual({ ok: true, url: DEFAULT_OLLAMA_URL });
  });
  it("accepts loopback addresses and maps 0.0.0.0", () => {
    expect(resolveOllamaUrl({ BOLBINDASS_OLLAMA_URL: "localhost:11500" })).toEqual({ ok: true, url: "http://localhost:11500" });
    expect(resolveOllamaUrl({ BOLBINDASS_OLLAMA_URL: "http://[::1]:11434" })).toEqual({ ok: true, url: "http://[::1]:11434" });
    expect(resolveOllamaUrl({ BOLBINDASS_OLLAMA_URL: "0.0.0.0:11434" })).toEqual({ ok: true, url: "http://127.0.0.1:11434" });
  });
  it("blocks remote and paid endpoints", () => {
    for (const bad of ["https://ollama.com", "http://192.168.1.20:11434", "https://api.openai.com/v1", "https://api.sarvam.ai", "ftp://localhost"]) {
      expect(resolveOllamaUrl({ BOLBINDASS_OLLAMA_URL: bad }).ok, bad).toBe(false);
    }
  });
  it("ignores OLLAMA_HOST (the server's own bind address)", () => {
    expect(resolveOllamaUrl({ OLLAMA_HOST: "https://ollama.com" })).toEqual({ ok: true, url: DEFAULT_OLLAMA_URL });
  });
});

describe("cloud model filtering", () => {
  it("hides Ollama Cloud models and embedding models", () => {
    const { local, cloudHidden } = partitionModels(TAGS.models);
    expect(local.map((m) => m.name)).toEqual(["llama3.2:3b"]);
    expect(cloudHidden).toEqual(["gemma4:31b-cloud"]);
    expect(isCloudModel({ name: "qwen3-coder:480b-cloud" })).toBe(true);
    expect(isCloudModel({ name: "gpt-oss:120b", remote_host: "https://ollama.com" })).toBe(true);
    expect(isCloudModel({ name: "llama3.2:3b" })).toBe(false);
  });

  it("picks a sensible local model", () => {
    const { local } = partitionModels(TAGS.models);
    expect(pickModel(local)).toBe("llama3.2:3b");
    expect(pickModel(local, "gemma4:31b-cloud")).toBe("llama3.2:3b");
    expect(pickModel([], "x")).toBeNull();
  });
});

describe("getOllamaStatus", () => {
  it("reports online with only local models", async () => {
    const calls: string[] = [];
    const s = await getOllamaStatus({ env: {}, fetchImpl: fakeFetch({ "/api/version": { version: "0.34.2" }, "/api/tags": TAGS }, calls), now: 1 });
    expect(s).toMatchObject({ state: "online", version: "0.34.2", recommendedModel: "llama3.2:3b", cloudModelsHidden: ["gemma4:31b-cloud"] });
    expect(calls.every((u) => u.startsWith("http://127.0.0.1:11434/"))).toBe(true);
  });

  it("reports offline when Ollama is not running", async () => {
    const failing = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const s = await getOllamaStatus({ env: {}, fetchImpl: failing });
    expect(s.state).toBe("offline");
    expect(s.message).toMatch(/not running/);
  });

  it("reports when no model is installed", async () => {
    const s = await getOllamaStatus({ env: {}, fetchImpl: fakeFetch({ "/api/version": { version: "1" }, "/api/tags": { models: [] } }) });
    expect(s).toMatchObject({ state: "online", models: [], recommendedModel: null });
    expect(s.message).toMatch(/no local chat model/);
  });

  it("never contacts a remote host, even if configured", async () => {
    const f = fakeFetch({});
    const s = await getOllamaStatus({ env: { BOLBINDASS_OLLAMA_URL: "https://ollama.com" }, fetchImpl: f });
    expect(s.state).toBe("blocked");
    expect(f).not.toHaveBeenCalled();
  });

  it("does not touch Sarvam even when a key exists", async () => {
    const calls: string[] = [];
    await getOllamaStatus({ env: { SARVAM_API_KEY: "sk-test" }, fetchImpl: fakeFetch({}, calls) });
    expect(calls.some((u) => u.includes("sarvam"))).toBe(false);
  });
});

describe("chat request validation", () => {
  const ok = { model: "llama3.2:3b", messages: [{ role: "user", content: "Hi" }] };
  it("accepts a normal request and clamps options", () => {
    const v = validateChatBody({ ...ok, options: { temperature: 9, num_predict: 99999 } });
    expect(v.ok && v.value.options).toEqual({ temperature: 1.5, num_predict: 1024 });
  });
  it("rejects cloud models, bad roles and oversized input", () => {
    expect(validateChatBody({ ...ok, model: "gemma4:31b-cloud" }).ok).toBe(false);
    expect(validateChatBody({ ...ok, messages: [{ role: "tool", content: "x" }] }).ok).toBe(false);
    expect(validateChatBody({ ...ok, messages: [{ role: "user", content: "x".repeat(7000) }] }).ok).toBe(false);
    expect(validateChatBody({ ...ok, messages: [] }).ok).toBe(false);
    expect(validateChatBody(null).ok).toBe(false);
  });
  it("builds a local payload with thinking disabled and the model kept warm", () => {
    const v = validateChatBody(ok);
    if (!v.ok) throw new Error("invalid");
    expect(ollamaChatPayload(v.value, true)).toMatchObject({ model: "llama3.2:3b", stream: true, think: false, keep_alive: "15m", options: { num_ctx: 4096 } });
  });
  it("checks that the model is installed locally", async () => {
    const f = fakeFetch({ "/api/tags": TAGS });
    expect(await isInstalledLocalModel("llama3.2:3b", DEFAULT_OLLAMA_URL, f)).toBe(true);
    expect(await isInstalledLocalModel("gemma4:31b-cloud", DEFAULT_OLLAMA_URL, f)).toBe(false);
    expect(await isInstalledLocalModel("mistral:7b", DEFAULT_OLLAMA_URL, f)).toBe(false);
  });
  it("rejects cross-site requests", () => {
    const req = (origin?: string) =>
      new Request("http://127.0.0.1:3000/api/ai/chat", { method: "POST", headers: { host: "127.0.0.1:3000", ...(origin ? { origin } : {}) } });
    expect(isSameOrigin(req("http://127.0.0.1:3000"))).toBe(true);
    expect(isSameOrigin(req())).toBe(true);
    expect(isSameOrigin(req("https://evil.example"))).toBe(false);
  });
});

describe("Sarvam (optional paid service)", () => {
  it("is always disabled and never exposes the key", () => {
    const withKey = getSarvamStatus({ SARVAM_API_KEY: "sk_live_SECRET123" });
    expect(withKey).toMatchObject({ keyConfigured: true, enabled: false, freeCreditsVerified: false });
    expect(JSON.stringify(withKey)).not.toContain("SECRET123");
    expect(getSarvamStatus({})).toMatchObject({ keyConfigured: false, enabled: false });
    expect(getSarvamStatus({ SARVAM_API_KEY: "   " }).keyConfigured).toBe(false);
  });
});
