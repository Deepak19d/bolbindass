import type { MistakeCategory } from "./types";

export interface CategoryInfo {
  label: string;
  /** Higher = more important to fix first (affects meaning / is very noticeable). */
  priority: number;
  /** Practical, one-line goal shown in session reports. */
  goal: string;
}

export const MISTAKE_CATEGORIES: Record<MistakeCategory, CategoryInfo> = {
  "past-tense": {
    label: "Past tense",
    priority: 10,
    goal: "When you talk about yesterday, last week or any finished time, use the past form: went, saw, completed. Try telling one short story about last weekend.",
  },
  "present-perfect": {
    label: "Present perfect (since / for)",
    priority: 9,
    goal: "For something that started in the past and continues now, say “I have been working here for two years” (for + length of time, since + starting point).",
  },
  "verb-forms": {
    label: "Verb forms",
    priority: 8,
    goal: "After did / didn't / can / will, use the base verb: “I didn't go”, “I can do it”.",
  },
  "subject-verb-agreement": {
    label: "Subject–verb agreement",
    priority: 8,
    goal: "With he / she / it, use doesn't, has and verb + s: “She doesn't know”, “He has a laptop”, “It works”.",
  },
  "question-form": {
    label: "Question form",
    priority: 7,
    goal: "In direct questions, put the helping verb before the subject: “What are you doing?”, “Where do you work?”",
  },
  "stative-verbs": {
    label: "Stative verbs (have / know)",
    priority: 6,
    goal: "Verbs like have (own), know and understand don't usually take -ing: say “I have two years of experience”, “I don't understand”.",
  },
  articles: {
    label: "Articles (a / an / the)",
    priority: 6,
    goal: "Use a / an before a single job or thing: “I am a software engineer”, “an interesting project”.",
  },
  "hindi-translation": {
    label: "Direct translation from Hindi",
    priority: 6,
    goal: "Some phrases don't translate word-for-word: say “this morning”, “last night”, “My name is…” instead of “today morning”, “yesterday night”, “myself…”.",
  },
  prepositions: {
    label: "Prepositions",
    priority: 5,
    goal: "Watch small words like to / with / at: “explain to me”, “married to”, “good at”.",
  },
  "redundant-words": {
    label: "Extra words",
    priority: 5,
    goal: "Drop words that repeat the meaning: “discuss the plan” (not discuss about), “return” (not return back).",
  },
  "uncountable-nouns": {
    label: "Uncountable nouns",
    priority: 5,
    goal: "Words like information, advice, feedback and equipment have no plural: “some useful information”, “a piece of advice”.",
  },
  "word-order": {
    label: "Word order",
    priority: 5,
    goal: "Keep the order subject → verb → object: “I really like this project”.",
  },
  comparatives: {
    label: "Comparatives",
    priority: 4,
    goal: "Use either -er or more, not both: “better”, “much easier”, “more interesting”.",
  },
  "word-choice": {
    label: "Word choice",
    priority: 4,
    goal: "Notice natural word pairs (collocations): “make a decision”, “do a project”, “take a break”.",
  },
  plurals: {
    label: "Plurals",
    priority: 3,
    goal: "Add -s for more than one: “two years”, “many projects”, “one of my friends”.",
  },
  pronouns: {
    label: "Pronouns",
    priority: 3,
    goal: "Keep he / she / they consistent with the person you are talking about.",
  },
  other: {
    label: "Other grammar",
    priority: 2,
    goal: "Speak in short, complete sentences first, then add details with “because” and “for example”.",
  },
};

export const ALL_MISTAKE_CATEGORIES = Object.keys(
  MISTAKE_CATEGORIES,
) as MistakeCategory[];

export function isMistakeCategory(value: unknown): value is MistakeCategory {
  return typeof value === "string" && value in MISTAKE_CATEGORIES;
}

export function normalizeCategory(value: unknown): MistakeCategory {
  if (isMistakeCategory(value)) return value;
  if (typeof value !== "string") return "other";
  const v = value.toLowerCase().trim();
  // Small models often return near-miss labels; map the common ones.
  if (/past/.test(v)) return "past-tense";
  if (/perfect|since|for\b/.test(v)) return "present-perfect";
  if (/agree|subject/.test(v)) return "subject-verb-agreement";
  if (/article/.test(v)) return "articles";
  if (/prepos/.test(v)) return "prepositions";
  if (/redundan|extra|unnecessary/.test(v)) return "redundant-words";
  if (/uncount|countable/.test(v)) return "uncountable-nouns";
  if (/stative|continuous/.test(v)) return "stative-verbs";
  if (/question/.test(v)) return "question-form";
  if (/order/.test(v)) return "word-order";
  if (/compar/.test(v)) return "comparatives";
  if (/hindi|translat|literal/.test(v)) return "hindi-translation";
  if (/vocab|word choice|collocation|word-choice/.test(v)) return "word-choice";
  if (/plural|singular/.test(v)) return "plurals";
  if (/pronoun/.test(v)) return "pronouns";
  if (/tense|verb/.test(v)) return "verb-forms";
  return "other";
}

export function categoryLabel(category: MistakeCategory): string {
  return MISTAKE_CATEGORIES[category]?.label ?? "Other grammar";
}
