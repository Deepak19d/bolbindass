"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyCommand({ command, note }: { command: string; note?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the command is visible to select manually */
    }
  };
  return (
    <div className="space-y-1">
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
      <div className="flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 font-mono text-[13px] text-background">
        <span className="min-w-0 select-all overflow-x-auto whitespace-nowrap">
          <span className="select-none text-background/50">PS&gt; </span>
          {command}
        </span>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          onClick={copy}
          className="ml-auto shrink-0 text-background hover:bg-background/15 hover:text-background"
          aria-label={copied ? "Copied" : `Copy command: ${command}`}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
    </div>
  );
}
