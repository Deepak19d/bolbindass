"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface ColumnDatum {
  key: string;
  /** Short x-axis label (e.g. a date). */
  tick: string;
  value: number;
  /** Secondary tooltip line (e.g. topic). */
  detail?: string;
}

function niceMax(v: number): number {
  if (v <= 0) return 10;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

/**
 * Single-series column chart. Columns ≤24px with 4px rounded caps, hairline
 * grid, per-column hover/focus tooltip, and only the latest value labelled.
 */
export function ColumnChart({
  data,
  unit,
  ariaLabel,
  height = 180,
}: {
  data: ColumnDatum[];
  unit: string;
  ariaLabel: string;
  height?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const ticks = [max, max / 2, 0];

  return (
    <figure aria-label={ariaLabel} className="space-y-2">
      <div className="flex gap-2">
        <div className="flex flex-col justify-between text-right text-[11px] text-muted-foreground tabular-nums" style={{ height }}>
          {ticks.map((t) => (
            <span key={t} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">
              {Math.round(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1" style={{ height }}>
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute inset-x-0 border-t border-border"
              style={{ top: `${(1 - t / max) * 100}%` }}
              aria-hidden="true"
            />
          ))}
          <div className="absolute inset-0 flex items-end justify-around gap-0.5">
            {data.map((d, i) => {
              const h = (d.value / max) * 100;
              const isLast = i === data.length - 1;
              return (
                <div
                  key={d.key}
                  className="relative flex h-full flex-1 cursor-default items-end justify-center outline-none"
                  tabIndex={0}
                  aria-label={`${d.tick}: ${d.value} ${unit}${d.detail ? `, ${d.detail}` : ""}`}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive((a) => (a === i ? null : a))}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive((a) => (a === i ? null : a))}
                >
                  <div
                    className={cn(
                      "w-full max-w-6 rounded-t-[4px] bg-chart-1 transition-opacity",
                      active !== null && active !== i && "opacity-55",
                    )}
                    style={{ height: `${Math.max(h, d.value > 0 ? 1.5 : 0)}%` }}
                  />
                  {isLast && active === null && d.value > 0 && (
                    <span
                      className="absolute text-[11px] font-semibold text-foreground tabular-nums"
                      style={{ bottom: `calc(${h}% + 4px)` }}
                    >
                      {d.value}
                    </span>
                  )}
                  {active === i && (
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute z-10 w-max max-w-48 -translate-x-1/2 rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md"
                      style={{ bottom: `calc(${h}% + 8px)`, left: "50%" }}
                    >
                      <p className="font-semibold tabular-nums">
                        {d.value} <span className="font-normal text-muted-foreground">{unit}</span>
                      </p>
                      <p className="text-muted-foreground">{d.tick}</p>
                      {d.detail && <p className="text-muted-foreground">{d.detail}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex justify-around gap-0.5 pl-7 text-[10px] text-muted-foreground">
        {data.map((d, i) => (
          <span key={d.key} className={cn("flex-1 truncate text-center", data.length > 8 && i % 2 === 1 && "invisible")}>
            {d.tick}
          </span>
        ))}
      </div>
    </figure>
  );
}

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  detail?: string;
}

/** Single-series horizontal bars, ranked, with the value at each bar tip. */
export function BarList({ data, ariaLabel, unit }: { data: BarDatum[]; ariaLabel: string; unit: string }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <figure aria-label={ariaLabel}>
      <ul className="space-y-2">
        {data.map((d) => (
          <li
            key={d.key}
            className="relative grid grid-cols-[minmax(7rem,11rem)_1fr] items-center gap-3 text-sm outline-none"
            tabIndex={0}
            aria-label={`${d.label}: ${d.value} ${d.value === 1 ? unit.replace(/s$/, "") : unit}${d.detail ? `, ${d.detail}` : ""}`}
            onPointerEnter={() => setActive(d.key)}
            onPointerLeave={() => setActive((a) => (a === d.key ? null : a))}
            onFocus={() => setActive(d.key)}
            onBlur={() => setActive((a) => (a === d.key ? null : a))}
          >
            <span className="truncate text-foreground">{d.label}</span>
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "h-3.5 rounded-r-[4px] bg-chart-1 transition-opacity",
                  active !== null && active !== d.key && "opacity-55",
                )}
                style={{ width: `${Math.max(2, (d.value / max) * 85)}%` }}
              />
              <span className="text-xs font-semibold tabular-nums">{d.value}</span>
            </span>
            {active === d.key && d.detail && (
              <span
                role="tooltip"
                className="pointer-events-none absolute right-0 -top-8 z-10 w-max max-w-64 rounded-lg border bg-popover px-2.5 py-1 text-xs text-muted-foreground shadow-md"
              >
                {d.detail}
              </span>
            )}
          </li>
        ))}
      </ul>
    </figure>
  );
}
