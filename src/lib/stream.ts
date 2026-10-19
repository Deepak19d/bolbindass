// NDJSON helpers shared by the server (Ollama → browser) and the browser.

export type ClientStreamEvent =
  | { type: "token"; text: string }
  | { type: "done"; evalCount?: number; totalDurationMs?: number }
  | { type: "error"; message: string };

/** Split a growing text buffer into complete JSON lines + the unfinished rest. */
export function splitNdjson(buffer: string): { lines: unknown[]; rest: string } {
  const parts = buffer.split("\n");
  const rest = parts.pop() ?? "";
  const lines: unknown[] = [];
  for (const p of parts) {
    const t = p.trim();
    if (!t) continue;
    try {
      lines.push(JSON.parse(t));
    } catch {
      /* skip malformed line */
    }
  }
  return { lines, rest };
}

/** Map one Ollama /api/chat stream line to our small client event format. */
export function ollamaLineToEvent(line: unknown): ClientStreamEvent | null {
  if (!line || typeof line !== "object") return null;
  const l = line as {
    error?: unknown;
    done?: boolean;
    message?: { content?: unknown };
    eval_count?: number;
    total_duration?: number;
  };
  if (typeof l.error === "string") return { type: "error", message: l.error };
  if (l.done) {
    return {
      type: "done",
      evalCount: l.eval_count,
      totalDurationMs: typeof l.total_duration === "number" ? Math.round(l.total_duration / 1e6) : undefined,
    };
  }
  // `message.thinking` (reasoning models) is intentionally dropped.
  const text = l.message?.content;
  return typeof text === "string" && text.length > 0 ? { type: "token", text } : null;
}

/** TransformStream: Ollama NDJSON bytes → our NDJSON bytes. */
export function ollamaToClientStream(): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";
  const emit = (ctrl: TransformStreamDefaultController<Uint8Array>, lines: unknown[]) => {
    for (const line of lines) {
      const ev = ollamaLineToEvent(line);
      if (ev) ctrl.enqueue(encoder.encode(`${JSON.stringify(ev)}\n`));
    }
  };
  return new TransformStream({
    transform(chunk, ctrl) {
      buffer += decoder.decode(chunk, { stream: true });
      const { lines, rest } = splitNdjson(buffer);
      buffer = rest;
      emit(ctrl, lines);
    },
    flush(ctrl) {
      const { lines } = splitNdjson(`${buffer}\n`);
      emit(ctrl, lines);
    },
  });
}

/** Ollama error bodies look like {"error":"..."}; fall back to raw text. */
export function parseOllamaError(text: string): string {
  try {
    const j = JSON.parse(text) as { error?: unknown };
    if (typeof j.error === "string") return j.error;
  } catch {
    /* not JSON */
  }
  return text.slice(0, 300);
}
