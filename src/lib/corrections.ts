import { MISTAKE_CATEGORIES, normalizeCategory } from "./categories";
import type { RuleHit } from "./grammar-rules";
import { findSourceSentence, normalizeText, substituteFragment, truncate, wordSimilarity, words } from "./text";
import type { Correction, CorrectionMode, MistakeCategory } from "./types";

/** Shape the local model is asked to return (see prompts.ts). */
export interface RawAiCorrection {
  original?: unknown;
  corrected?: unknown;
  explanation?: unknown;
  alternative?: unknown;
  category?: unknown;
}

export type DropReason =
  | "missing-fields"
  | "not-in-learner-text"
  | "no-real-change"
  | "rewrote-too-much"
  | "style-only"
  | "useless-explanation";

export interface ValidationResult {
  accepted: Correction[];
  dropped: { raw: RawAiCorrection; reason: DropReason }[];
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Validate corrections from the local model against what the learner
 * actually said. Small local models sometimes invent sentences, "fix"
 * correct ones, or only change punctuation (meaningless for speech input).
 * Anything that is not anchored in the learner's words is dropped.
 */
export function validateAiCorrections(
  raws: unknown,
  learnerText: string,
  turnId: string,
  makeId: () => string,
): ValidationResult {
  const accepted: Correction[] = [];
  const dropped: ValidationResult["dropped"] = [];
  const list = Array.isArray(raws) ? (raws as RawAiCorrection[]) : [];

  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const quoted = str(raw.original);
    const correctedRaw = str(raw.corrected);
    const explanation = str(raw.explanation);
    if (!quoted || !correctedRaw || !explanation) {
      dropped.push({ raw, reason: "missing-fields" });
      continue;
    }
    const source = findSourceSentence(learnerText, quoted);
    if (!source) {
      dropped.push({ raw, reason: "not-in-learner-text" });
      continue;
    }
    // Always show the learner's own full sentence. If the model corrected only
    // a fragment ("I go" → "I went"), put the fix back into that sentence.
    const original = source;
    const isFragment = normalizeText(quoted) !== normalizeText(source);
    // The model may return a fixed fragment ("I went") or a fixed full
    // sentence. Use whichever reading has a length closest to the learner's.
    const sourceLen = words(source).length;
    const inSentence = (text: string) => {
      if (!isFragment || !text) return text;
      const substituted = substituteFragment(source, quoted, text);
      if (!substituted) return text;
      const gap = (t: string) => Math.abs(words(t).length - sourceLen);
      return gap(substituted) <= gap(text) ? substituted : text;
    };
    const corrected = inSentence(correctedRaw);
    if (normalizeText(original) === normalizeText(corrected)) {
      dropped.push({ raw, reason: "no-real-change" });
      continue;
    }
    if (wordSimilarity(original, corrected) < 0.35) {
      dropped.push({ raw, reason: "rewrote-too-much" });
      continue;
    }
    const category = normalizeCategory(raw.category);
    // Same words, different order ("learn new things quickly" → "quickly learn
    // new things") is style, not a mistake — unless word order is the point.
    if (sameWordBag(original, corrected) && category !== "word-order" && category !== "question-form") {
      dropped.push({ raw, reason: "style-only" });
      continue;
    }
    if (!usefulExplanation(explanation)) {
      dropped.push({ raw, reason: "useless-explanation" });
      continue;
    }
    // Small models sometimes repeat the same correction several times.
    const dupe = accepted.some(
      (a) =>
        normalizeText(a.original) === normalizeText(original) &&
        normalizeText(a.corrected) === normalizeText(corrected),
    );
    if (dupe) continue;
    const alternative = inSentence(str(raw.alternative));
    accepted.push({
      id: makeId(),
      turnId,
      original,
      corrected: truncate(corrected, 400),
      explanation: truncate(explanation, 300),
      alternative:
        alternative && normalizeText(alternative) !== normalizeText(corrected)
          ? truncate(alternative, 400)
          : undefined,
      category,
      source: "ai",
    });
  }
  return { accepted, dropped };
}

/** Explanations like "I was told" or "No change needed" teach nothing. */
export function usefulExplanation(explanation: string): boolean {
  if (words(explanation).length < 4) return false;
  return !/\b(no change|no changes|already correct|is correct|correct sentence|no mistakes?|nothing to (fix|correct))\b/i.test(explanation);
}

function sameWordBag(a: string, b: string): boolean {
  const sa = [...words(a)].sort().join(" ");
  const sb = [...words(b)].sort().join(" ");
  return sa === sb;
}

export function ruleHitsToCorrections(
  hits: RuleHit[],
  turnId: string,
  makeId: () => string,
): Correction[] {
  return hits.map((h) => ({
    id: makeId(),
    turnId,
    original: h.original,
    corrected: h.corrected,
    explanation: h.explanation,
    alternative: h.alternative,
    category: h.category,
    source: "rule" as const,
    ruleId: h.ruleId,
  }));
}

function overlaps(a: Correction, b: Correction): boolean {
  const na = normalizeText(a.original);
  const nb = normalizeText(b.original);
  return na === nb || na.includes(nb) || nb.includes(na);
}

/**
 * True when correction `b` fixes (part of) the same problem as `a` on the same
 * sentence: applying b moves the sentence toward a's fixed version.
 */
function sameFix(a: Correction, b: Correction): boolean {
  if (!overlaps(a, b)) return false;
  if (a.category === b.category) return true;
  if (normalizeText(a.corrected) === normalizeText(b.corrected)) return true;
  return wordSimilarity(b.corrected, a.corrected) > wordSimilarity(b.original, a.corrected);
}

/**
 * Combine rule-based and AI corrections. When both flag the same problem in
 * the same sentence, the deterministic rule wins (its explanation is reviewed,
 * the AI's is not). AI corrections for other problems are kept.
 */
export function mergeCorrections(rule: Correction[], ai: Correction[]): Correction[] {
  const out = [...rule];
  for (const c of ai) {
    if (!out.some((r) => sameFix(r, c))) out.push(c);
  }
  return out;
}

/**
 * Order by importance: recurring weaknesses first, then grammar areas that
 * most affect meaning, then rule-based (higher confidence) before AI.
 */
export function rankCorrections(
  corrections: Correction[],
  recurring: ReadonlySet<MistakeCategory> = new Set(),
): Correction[] {
  return [...corrections].sort((a, b) => {
    const ra = recurring.has(a.category) ? 1 : 0;
    const rb = recurring.has(b.category) ? 1 : 0;
    if (ra !== rb) return rb - ra;
    const pa = MISTAKE_CATEGORIES[a.category].priority;
    const pb = MISTAKE_CATEGORIES[b.category].priority;
    if (pa !== pb) return pb - pa;
    if (a.source !== b.source) return a.source === "rule" ? -1 : 1;
    return 0;
  });
}

/** How many corrections to show right after a turn, per mode. */
export function visibleCorrectionLimit(mode: CorrectionMode): number {
  switch (mode) {
    case "friendly":
      return 2; // "one or two important mistakes"
    case "instant":
      return 3;
    case "immersion":
      return 0; // shown only in the end-of-session report
  }
}

export function correctionsToShow(
  corrections: Correction[],
  mode: CorrectionMode,
  recurring?: ReadonlySet<MistakeCategory>,
): Correction[] {
  return rankCorrections(corrections, recurring).slice(0, visibleCorrectionLimit(mode));
}

/** Shape used by the UI and tests to describe one correction card. */
export function formatCorrection(c: Correction): {
  youSaid: string;
  better: string;
  why: string;
  alsoNatural?: string;
  tag: string;
} {
  return {
    youSaid: c.original,
    better: c.corrected,
    why: c.explanation,
    alsoNatural: c.alternative,
    tag: `${MISTAKE_CATEGORIES[c.category].label}${c.source === "rule" ? " · rule check" : " · local AI"}`,
  };
}
