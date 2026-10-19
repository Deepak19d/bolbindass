import { ArrowRight, Lightbulb } from "lucide-react";
import { formatCorrection } from "@/lib/corrections";
import type { Correction } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CorrectionCard({ correction, compact = false }: { correction: Correction; compact?: boolean }) {
  const c = formatCorrection(correction);
  return (
    <article
      className={cn(
        "rounded-xl border border-highlight/40 bg-accent/40 text-sm",
        compact ? "space-y-1.5 p-3" : "space-y-2 p-4",
      )}
      aria-label="Correction"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-accent-foreground/80">{c.tag}</p>
      <div className="grid gap-1.5 sm:grid-cols-[auto_1fr] sm:gap-x-3">
        <span className="text-xs font-medium text-muted-foreground sm:pt-0.5">You said</span>
        <p className="text-foreground/80 line-through decoration-destructive/50 decoration-1">{c.youSaid}</p>
        <span className="text-xs font-medium text-muted-foreground sm:pt-0.5">Better</span>
        <p className="flex items-start gap-1.5 font-medium text-secondary-foreground">
          <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          {c.better}
        </p>
      </div>
      <p className="text-muted-foreground">{c.why}</p>
      {c.alsoNatural && (
        <p className="flex items-start gap-1.5 text-foreground/90">
          <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-highlight" aria-hidden="true" />
          <span>
            <span className="font-medium">Also natural:</span> {c.alsoNatural}
          </span>
        </p>
      )}
    </article>
  );
}
