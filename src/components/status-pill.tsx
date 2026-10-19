import { cn } from "@/lib/utils";

export type PillTone = "good" | "warn" | "bad" | "idle" | "live";

const TONES: Record<PillTone, { dot: string; pill: string }> = {
  good: { dot: "bg-success", pill: "bg-secondary text-secondary-foreground" },
  live: { dot: "bg-primary animate-pulse", pill: "bg-secondary text-secondary-foreground" },
  warn: { dot: "bg-highlight", pill: "bg-accent text-accent-foreground" },
  bad: { dot: "bg-destructive", pill: "bg-destructive/10 text-destructive" },
  idle: { dot: "bg-muted-foreground/50", pill: "bg-muted text-muted-foreground" },
};

export function StatusPill({
  tone,
  children,
  className,
  title,
}: {
  tone: PillTone;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const t = TONES[tone];
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        t.pill,
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", t.dot)} aria-hidden="true" />
      <span className="truncate">{children}</span>
    </span>
  );
}
