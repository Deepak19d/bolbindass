import { prepareLocalAiRequest } from "@/lib/server/ai-proxy";
import { ollamaChatPayload } from "@/lib/server/ollama";
import { ollamaToClientStream, parseOllamaError } from "@/lib/stream";

// Streams a conversational reply from the LOCAL Ollama model. There is no
// fallback to any external provider: if Ollama fails, the client is told so.
export async function POST(request: Request) {
  const prepared = await prepareLocalAiRequest(request);
  if (!prepared.ok) return prepared.response;

  let upstream: Response;
  try {
    upstream = await fetch(`${prepared.url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ollamaChatPayload(prepared.body, true)),
      signal: request.signal,
    });
  } catch {
    return Response.json(
      { error: "The local AI (Ollama) stopped responding. Check that it is still running." },
      { status: 503 },
    );
  }
  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => "");
    return Response.json(
      { error: parseOllamaError(text) || `Ollama returned HTTP ${upstream.status}.` },
      { status: 502 },
    );
  }
  return new Response(upstream.body.pipeThrough(ollamaToClientStream()), {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
