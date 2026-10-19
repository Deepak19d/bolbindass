import { prepareLocalAiRequest } from "@/lib/server/ai-proxy";
import { ollamaChatPayload } from "@/lib/server/ollama";
import { parseOllamaError } from "@/lib/stream";
import { stripThinking } from "@/lib/text";

// Non-streaming JSON generation (corrections, session summary) on the LOCAL
// Ollama model, using its structured-output `format` schema.
export async function POST(request: Request) {
  const prepared = await prepareLocalAiRequest(request);
  if (!prepared.ok) return prepared.response;

  const timeout = AbortSignal.timeout(150_000);
  const signal = AbortSignal.any([request.signal, timeout]);
  let upstream: Response;
  try {
    upstream = await fetch(`${prepared.url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ollamaChatPayload(prepared.body, false)),
      signal,
    });
  } catch {
    const message = timeout.aborted
      ? "The local AI took too long to answer."
      : "The local AI (Ollama) stopped responding.";
    return Response.json({ error: message }, { status: 503 });
  }
  const text = await upstream.text();
  if (!upstream.ok) {
    return Response.json({ error: parseOllamaError(text) || `Ollama returned HTTP ${upstream.status}.` }, { status: 502 });
  }
  let content = "";
  try {
    content = stripThinking((JSON.parse(text) as { message?: { content?: string } }).message?.content ?? "");
  } catch {
    return Response.json({ error: "Unexpected response from Ollama." }, { status: 502 });
  }
  return Response.json({ content, model: prepared.body.model }, { headers: { "Cache-Control": "no-store" } });
}
