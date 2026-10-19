// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => {} }));

import { POST as chatPOST } from "./ai/chat/route";
import { POST as completePOST } from "./ai/complete/route";
import { GET as statusGET } from "./ai/status/route";
import { GET as sarvamGET } from "./sarvam/status/route";
import { resetInstalledCache } from "@/lib/server/ollama";

const TAGS = { models: [{ name: "llama3.2:3b", size: 1 }, { name: "gemma4:31b-cloud", size: 1, remote_host: "https://ollama.com" }] };
let calls: string[] = [];

function ndjson(lines: object[]): Response {
  return new Response(lines.map((l) => JSON.stringify(l)).join("\n") + "\n", { status: 200 });
}

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      return handler(url, init);
    }),
  );
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://127.0.0.1:3000${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", host: "127.0.0.1:3000", ...headers },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  calls = [];
  resetInstalledCache();
  vi.stubEnv("BOLBINDASS_OLLAMA_URL", "");
  vi.stubEnv("SARVAM_API_KEY", "");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("/api/ai/chat", () => {
  it("streams tokens from the local model as NDJSON", async () => {
    mockFetch((url) =>
      url.endsWith("/api/tags")
        ? Response.json(TAGS)
        : ndjson([
            { message: { role: "assistant", content: "Hi " } },
            { message: { role: "assistant", content: "there!", thinking: "secret reasoning" } },
            { done: true, eval_count: 2, total_duration: 5e9 },
          ]),
    );
    const res = await chatPOST(post("/api/ai/chat", { model: "llama3.2:3b", messages: [{ role: "user", content: "Hello" }] }));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text.trim().split("\n").map((l) => JSON.parse(l))).toEqual([
      { type: "token", text: "Hi " },
      { type: "token", text: "there!" },
      { type: "done", evalCount: 2, totalDurationMs: 5000 },
    ]);
    expect(text).not.toContain("secret reasoning");
    expect(calls.every((u) => u.startsWith("http://127.0.0.1:11434/"))).toBe(true);
  });

  it("refuses cloud models without calling anything", async () => {
    mockFetch(() => Response.json(TAGS));
    const res = await chatPOST(post("/api/ai/chat", { model: "gemma4:31b-cloud", messages: [{ role: "user", content: "Hi" }] }));
    expect(res.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it("refuses models that aren't installed locally", async () => {
    mockFetch(() => Response.json(TAGS));
    const res = await chatPOST(post("/api/ai/chat", { model: "gpt-4o", messages: [{ role: "user", content: "Hi" }] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/not installed/);
  });

  it("reports Ollama being down — and does NOT fall back to any external API", async () => {
    mockFetch(() => {
      throw new TypeError("fetch failed");
    });
    vi.stubEnv("SARVAM_API_KEY", "sk-should-not-be-used");
    const res = await chatPOST(post("/api/ai/chat", { model: "llama3.2:3b", messages: [{ role: "user", content: "Hi" }] }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/Ollama/);
    expect(calls.every((u) => u.startsWith("http://127.0.0.1:11434/"))).toBe(true);
  });

  it("blocks a remote Ollama URL", async () => {
    vi.stubEnv("BOLBINDASS_OLLAMA_URL", "https://ollama.com");
    mockFetch(() => Response.json(TAGS));
    const res = await chatPOST(post("/api/ai/chat", { model: "llama3.2:3b", messages: [{ role: "user", content: "Hi" }] }));
    expect(res.status).toBe(403);
    expect(calls).toEqual([]);
  });

  it("blocks cross-site requests", async () => {
    mockFetch(() => Response.json(TAGS));
    const res = await chatPOST(post("/api/ai/chat", { model: "llama3.2:3b", messages: [{ role: "user", content: "Hi" }] }, { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect(calls).toEqual([]);
  });
});

describe("/api/ai/complete", () => {
  it("returns JSON content with think blocks removed", async () => {
    mockFetch((url) =>
      url.endsWith("/api/tags") ? Response.json(TAGS) : Response.json({ message: { content: '<think>x</think>{"corrections":[]}' } }),
    );
    const res = await completePOST(post("/api/ai/complete", { model: "llama3.2:3b", messages: [{ role: "user", content: "x" }], format: { type: "object" } }));
    expect(await res.json()).toEqual({ content: '{"corrections":[]}', model: "llama3.2:3b" });
    const sent = JSON.parse(String((vi.mocked(fetch).mock.calls[1][1] as RequestInit).body));
    expect(sent).toMatchObject({ stream: false, think: false, format: { type: "object" } });
  });
});

describe("status routes", () => {
  it("/api/ai/status reports offline cleanly", async () => {
    mockFetch(() => {
      throw new TypeError("fetch failed");
    });
    const res = await statusGET();
    expect((await res.json()).state).toBe("offline");
  });

  it("/api/sarvam/status works without credentials and never leaks a key", async () => {
    mockFetch(() => new Response("should not be called"));
    let body = await (await sarvamGET()).json();
    expect(body).toMatchObject({ keyConfigured: false, enabled: false });
    vi.stubEnv("SARVAM_API_KEY", "sk_live_TOPSECRET");
    const raw = await (await sarvamGET()).text();
    body = JSON.parse(raw);
    expect(body).toMatchObject({ keyConfigured: true, enabled: false, freeCreditsVerified: false });
    expect(raw).not.toContain("TOPSECRET");
    expect(calls).toEqual([]);
  });
});
