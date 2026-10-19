import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_ENDPOINTS, completeJson, LocalAiError, parseJsonLoose, streamChat } from "./ai-client";
import { decideEngine } from "./engine";
import type { OllamaStatus } from "./server/ollama";
import { splitNdjson } from "./stream";

afterEach(() => vi.unstubAllGlobals());

function streamResponse(chunks: string[]): Response {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(c) {
        for (const ch of chunks) c.enqueue(enc.encode(ch));
        c.close();
      },
    }),
    { status: 200 },
  );
}

describe("ai-client", () => {
  it("only ever calls this app's own relative /api routes", () => {
    for (const url of Object.values(AI_ENDPOINTS)) expect(url).toMatch(/^\/api\//);
  });

  it("assembles streamed tokens split across chunks", async () => {
    const fetchMock = vi.fn(async () =>
      streamResponse(['{"type":"token","text":"Hel', 'lo"}\n{"type":"token","text":" there"}\n', '{"type":"done"}\n']),
    );
    vi.stubGlobal("fetch", fetchMock);
    const seen: string[] = [];
    const text = await streamChat({ model: "m", messages: [{ role: "user", content: "x" }] }, { onText: (t) => seen.push(t) });
    expect(text).toBe("Hello there");
    expect(seen).toEqual(["Hello", "Hello there"]);
    expect(fetchMock).toHaveBeenCalledWith("/api/ai/chat", expect.anything());
  });

  it("surfaces local AI errors instead of falling back", async () => {
    const fetchMock = vi.fn(async () => Response.json({ error: "The local AI (Ollama) is not reachable." }, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(streamChat({ model: "m", messages: [{ role: "user", content: "x" }] })).rejects.toMatchObject({ kind: "offline" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.every((c: unknown[]) => String(c[0]).startsWith("/api/"))).toBe(true);
  });

  it("reports an error event mid-stream", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => streamResponse(['{"type":"error","message":"model crashed"}\n'])));
    await expect(streamChat({ model: "m", messages: [{ role: "user", content: "x" }] })).rejects.toThrow("model crashed");
  });

  it("parses JSON from the complete endpoint, tolerating fences", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ content: '```json\n{"corrections":[]}\n```' })));
    await expect(completeJson({ model: "m", messages: [], schema: {} })).resolves.toEqual({ corrections: [] });
    expect(parseJsonLoose('Sure! {"a":1} hope that helps')).toEqual({ a: 1 });
    expect(() => parseJsonLoose("no json")).toThrow(LocalAiError);
  });

  it("splits NDJSON keeping the unfinished tail", () => {
    expect(splitNdjson('{"a":1}\n{"b":')).toEqual({ lines: [{ a: 1 }], rest: '{"b":' });
  });
});

describe("decideEngine — never an automatic external fallback", () => {
  const status = (over: Partial<OllamaStatus>): OllamaStatus => ({
    state: "online", url: "http://127.0.0.1:11434", version: "0.34.2", models: [], cloudModelsHidden: [],
    recommendedModel: null, message: "", checkedAt: 0, ...over,
  });
  const local = { name: "llama3.2:3b", sizeBytes: 1, family: "llama", parameterSize: "3B", quantization: "Q4" };

  it("uses the local model when available", () => {
    expect(decideEngine(status({ models: [local], recommendedModel: "llama3.2:3b" }), "", false)).toEqual({ engine: "ollama", model: "llama3.2:3b" });
    expect(decideEngine(status({ models: [local], recommendedModel: "llama3.2:3b" }), "missing:7b", false)).toEqual({ engine: "ollama", model: "llama3.2:3b" });
  });

  it("does not switch to Basic mode by itself when Ollama is down", () => {
    const d = decideEngine(status({ state: "offline", message: "Ollama is not running" }), "", false);
    expect(d).toEqual({ engine: "unavailable", reason: "Ollama is not running", canRetry: true });
  });

  it("uses Basic mode only when the learner chooses it", () => {
    expect(decideEngine(status({ state: "offline" }), "", true)).toEqual({ engine: "basic" });
  });

  it("explains a missing model", () => {
    const d = decideEngine(status({}), "", false);
    expect(d.engine).toBe("unavailable");
  });

  it("only ever returns local or basic engines", () => {
    const engines = new Set(
      [status({}), status({ state: "offline" }), status({ state: "blocked" }), status({ models: [local], recommendedModel: local.name }), null].flatMap((s) =>
        [true, false].map((b) => decideEngine(s, "", b).engine),
      ),
    );
    expect([...engines].every((e) => ["ollama", "basic", "unavailable"].includes(e))).toBe(true);
  });
});
