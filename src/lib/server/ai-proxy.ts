// Shared request handling for the local-AI route handlers.

import {
  isInstalledLocalModel,
  isSameOrigin,
  resolveOllamaUrl,
  validateChatBody,
  type ChatRequestBody,
} from "./ollama";

export type Prepared =
  | { ok: true; url: string; body: ChatRequestBody }
  | { ok: false; response: Response };

const fail = (status: number, error: string): Prepared => ({
  ok: false,
  response: Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } }),
});

export async function prepareLocalAiRequest(
  request: Request,
  fetchImpl: typeof fetch = fetch,
  env: Record<string, string | undefined> = process.env,
): Promise<Prepared> {
  if (!isSameOrigin(request)) return fail(403, "Cross-site requests are not allowed.");
  const resolved = resolveOllamaUrl(env);
  if (!resolved.ok) return fail(403, resolved.reason);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return fail(400, "Request body must be JSON.");
  }
  const v = validateChatBody(json);
  if (!v.ok) return fail(400, v.error);

  try {
    const installed = await isInstalledLocalModel(v.value.model, resolved.url, fetchImpl);
    if (!installed) {
      return fail(400, `The model "${v.value.model}" is not installed on this computer. Choose an installed model in Settings.`);
    }
  } catch {
    return fail(503, "The local AI (Ollama) is not reachable. Start Ollama and try again.");
  }
  return { ok: true, url: resolved.url, body: v.value };
}
