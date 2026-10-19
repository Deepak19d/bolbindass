import { CopyCommand } from "@/components/copy-command";
import type { OllamaStatus } from "@/lib/ai-client";

/** Windows PowerShell steps for whatever is missing. */
export function AiSetupHelp({ status }: { status: OllamaStatus | null }) {
  const noModel = status?.state === "online" && status.models.length === 0;
  const blocked = status?.state === "blocked";

  if (blocked) {
    return (
      <div className="space-y-2 text-sm">
        <p>{status.message}</p>
        <p className="text-muted-foreground">
          Remove <code className="rounded bg-muted px-1">BOLBINDASS_OLLAMA_URL</code> from <code className="rounded bg-muted px-1">.env.local</code> to
          use the default <code className="rounded bg-muted px-1">http://127.0.0.1:11434</code>, then restart the app.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      {!noModel && (
        <>
          <p>
            Start Ollama from the Start menu (it runs in the system tray), or run this in PowerShell and keep the window open:
          </p>
          <CopyCommand command="ollama serve" />
          <p className="text-xs text-muted-foreground">
            Not installed? Install the free Ollama app (about 1 GB) with winget, then reopen PowerShell:
          </p>
          <CopyCommand command="winget install --id Ollama.Ollama -e" />
        </>
      )}
      <p>{noModel ? "Download a small local model (about 2.0 GB, one time):" : "If you have no model yet, download a small one (about 2.0 GB, one time):"}</p>
      <CopyCommand command="ollama pull llama3.2:3b" />
      <p className="text-xs text-muted-foreground">
        Models run fully on your computer. Avoid model names ending in <code>-cloud</code>: those run on ollama.com, not
        on your PC, and BolBindass will not use them.
      </p>
    </div>
  );
}
