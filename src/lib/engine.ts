import type { OllamaStatus } from "./server/ollama";

export type EngineDecision =
  | { engine: "ollama"; model: string }
  | { engine: "basic" }
  | { engine: "unavailable"; reason: string; canRetry: boolean };

/**
 * Decide how a session runs. There are only two engines — the LOCAL Ollama
 * model or the clearly-labelled Basic practice mode — and switching to Basic
 * only ever happens when the learner explicitly chooses it. No external or
 * paid provider exists as a fallback.
 */
export function decideEngine(
  status: OllamaStatus | null,
  preferredModel: string,
  learnerChoseBasic: boolean,
): EngineDecision {
  if (learnerChoseBasic) return { engine: "basic" };
  if (!status) return { engine: "unavailable", reason: "Checking the local AI…", canRetry: true };
  if (status.state !== "online") {
    return { engine: "unavailable", reason: status.message, canRetry: status.state !== "blocked" };
  }
  const installed = (name: string) => status.models.some((m) => m.name === name);
  const model = preferredModel && installed(preferredModel) ? preferredModel : status.recommendedModel;
  if (!model) {
    return {
      engine: "unavailable",
      reason: "Ollama is running, but no local chat model is installed yet.",
      canRetry: true,
    };
  }
  return { engine: "ollama", model };
}
