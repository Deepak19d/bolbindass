// Small, dependency-free text helpers used by grammar checks, correction
// validation and session reports.

/** Lowercase, drop punctuation, collapse whitespace. Apostrophes are kept. */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function words(text: string): string[] {
  const n = normalizeText(text);
  return n ? n.split(" ") : [];
}

export function wordCount(text: string): number {
  return words(text).length;
}

/**
 * Split learner speech into sentences. Speech recognition often gives no
 * punctuation, so a very long unpunctuated chunk is kept as one sentence.
 */
export function splitSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const parts = cleaned.match(/[^.!?]+[.!?]*/g) ?? [cleaned];
  return parts.map((p) => p.trim()).filter((p) => /\p{L}/u.test(p));
}

/** True when `needle` appears in `haystack`, ignoring case and punctuation. */
export function containsNormalized(haystack: string, needle: string): boolean {
  const n = normalizeText(needle);
  if (!n) return false;
  return ` ${normalizeText(haystack)} `.includes(` ${n} `);
}

/** Jaccard similarity of word sets (0..1). */
export function wordSimilarity(a: string, b: string): number {
  const wa = new Set(words(a));
  const wb = new Set(words(b));
  if (wa.size === 0 && wb.size === 0) return 1;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter += 1;
  return inter / (wa.size + wb.size - inter);
}

/**
 * Find the learner sentence that best matches a quoted fragment. Used to
 * anchor AI corrections to words the learner actually said.
 */
export function findSourceSentence(
  learnerText: string,
  quoted: string,
): string | null {
  if (!quoted.trim()) return null;
  const sentences = splitSentences(learnerText);
  // 1. Exact (normalised) containment inside a sentence.
  for (const s of sentences) {
    if (containsNormalized(s, quoted)) return s;
  }
  // 2. Quote spans several sentences but is inside the full text.
  if (containsNormalized(learnerText, quoted)) return quoted.trim();
  // 3. Near match (speech text vs. model's copy can differ slightly).
  let best: { s: string; score: number } | null = null;
  for (const s of sentences) {
    const score = wordSimilarity(s, quoted);
    if (!best || score > best.score) best = { s, score };
  }
  return best && best.score >= 0.75 ? best.s : null;
}

// "like" is deliberately excluded: "I like coding" is not a filler.
/**
 * Replace a quoted fragment inside a sentence (matched ignoring case and
 * punctuation) with its correction. Returns null if the fragment isn't found.
 * Small models often correct "Yesterday I go" → "Yesterday I went" instead of
 * returning the whole sentence.
 */
export function substituteFragment(sentence: string, fragment: string, replacement: string): string | null {
  const ws = words(fragment);
  if (ws.length === 0) return null;
  const pattern = ws
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/'/g, "['’]"))
    .join("[^\\p{L}\\p{N}'’]+");
  const m = new RegExp(`(?<![\\p{L}\\p{N}])${pattern}(?![\\p{L}\\p{N}])`, "iu").exec(sentence);
  if (!m) return null;
  const rep = replacement.trim().replace(/[.!?]+$/, "");
  return sentence.slice(0, m.index) + matchCase(rep, m[0]) + sentence.slice(m.index + m[0].length);
}

export const FILLER_WORDS = ["um", "umm", "uh", "uhh", "hmm", "er", "erm", "basically", "actually", "you know"];

export function countFillers(text: string): number {
  const n = ` ${normalizeText(text)} `;
  let count = 0;
  for (const f of FILLER_WORDS) {
    const re = new RegExp(` ${f}(?= )`, "g");
    count += (n.match(re) ?? []).length;
  }
  return count;
}

/** Counts immediate word repetitions such as "I I" or "the the". */
export function countRepeatedWords(text: string): number {
  const w = words(text);
  let count = 0;
  for (let i = 1; i < w.length; i += 1) if (w[i] === w[i - 1]) count += 1;
  return count;
}

export function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Keep the original's first-letter case when we rebuild a sentence. */
export function matchCase(replacement: string, original: string): string {
  if (!original) return replacement;
  const first = original.charAt(0);
  if (first === first.toUpperCase() && first !== first.toLowerCase()) {
    return capitalizeFirst(replacement);
  }
  return replacement;
}

/** Remove <think>…</think> blocks some local reasoning models emit. */
export function stripThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/i, "")
    .trimStart();
}

/**
 * Enforce "one question at a time": small local models often ask two or three
 * questions in a row. Keep the reply up to and including its first question.
 */
export function keepFirstQuestion(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const firstQ = sentences.findIndex((s) => s.trim().endsWith("?"));
  if (firstQ === -1) return text.trim();
  const laterQ = sentences.slice(firstQ + 1).some((s) => s.trim().endsWith("?"));
  return laterQ ? sentences.slice(0, firstQ + 1).join("").trim() : text.trim();
}

/** Make model output suitable for reading aloud. */
export function cleanForSpeech(text: string): string {
  return stripThinking(text)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_#`>~]/g, "")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/** "1 answer", "3 answers". */
export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${n} ${n === 1 ? word : pluralWord}`;
}
