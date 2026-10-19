// Prompts for the LOCAL Ollama model. Kept short on purpose: shorter prompts
// = faster replies and less memory on a CPU-only laptop.

import { ALL_MISTAKE_CATEGORIES, categoryLabel } from "./categories";
import type { Topic } from "./topics";
import { LEVEL_LABELS } from "./topics";
import type { CorrectionMode, MistakeCategory, Settings, TranscriptTurn } from "./types";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const LEVEL_STYLE: Record<Settings["level"], string> = {
  beginner: "Use very simple words and short sentences.",
  intermediate: "Use simple, everyday English.",
  "upper-intermediate": "Use natural everyday English with some useful phrases.",
  advanced: "Use natural, fluent English, including idioms now and then.",
};

export interface CoachPromptInput {
  settings: Pick<Settings, "name" | "goal" | "level" | "helpLanguage" | "correctionMode">;
  topic: Topic;
  focusCategories: MistakeCategory[];
  avoidQuestions: string[];
}

export function coachSystemPrompt({ settings, topic, focusCategories, avoidQuestions }: CoachPromptInput): string {
  const lines = [
    `You are Bindass Coach, a warm, friendly English speaking partner for an Indian learner${settings.name ? ` named ${settings.name}` : ""}.`,
    `Learner level: ${LEVEL_LABELS[settings.level]}. ${LEVEL_STYLE[settings.level]}`,
    settings.goal ? `Learner goal: ${settings.goal}.` : "",
    `Topic: ${topic.title}. ${topic.angle}`,
    "Rules:",
    "- Talk like a supportive friend, not a teacher. Reply in 1-3 short sentences, then ask exactly ONE short question. Never join two questions with \"and\".",
    "- React to what the learner actually said and ask a relevant follow-up question.",
    "- If an answer is very short, gently ask for more detail, a reason, or an example.",
    "- Do not correct grammar and do not list mistakes (corrections are shown separately). You may naturally reuse the correct form of something they said.",
    "- Plain spoken text only: no lists, no markdown, no emojis. Your words are read aloud.",
    settings.helpLanguage === "hinglish"
      ? "- If the learner says they don't understand, or writes in Hindi/Hinglish, add one short line starting with 'Matlab:' in simple Hindi written in English letters, then continue in English."
      : "- If the learner seems confused, rephrase in simpler English.",
    "- Never pretend to hear the learner's voice or judge pronunciation; you only see text.",
  ];
  if (focusCategories.length > 0) {
    lines.push(
      `- Ask questions that naturally make the learner use: ${focusCategories.map((c) => categoryLabel(c).toLowerCase()).join(", ")}.`,
    );
  }
  if (avoidQuestions.length > 0) {
    lines.push(`- Do not repeat these earlier questions: ${avoidQuestions.slice(0, 8).map((q) => `"${q}"`).join("; ")}.`);
  }
  return lines.filter(Boolean).join("\n");
}

/** Hidden instruction that makes the coach open the conversation. Never shown as a learner turn. */
export function openingInstruction(name: string): string {
  return `(Start the conversation now. Greet ${name || "the learner"} in one short sentence and ask your first question about the topic.)`;
}

/** Hidden instruction for the "Say it simpler" helper button. */
export function simplerInstruction(helpLanguage: Settings["helpLanguage"]): string {
  // Tuned on llama3.2:3b: a fixed two-line format with an example gives clean
  // Hinglish; a free-form "add a Hindi explanation" produced garbled text.
  return helpLanguage === "hinglish"
    ? "(The learner didn't understand your last question. Reply in exactly two lines. Line 1: ask the same question again in very simple English, one short sentence. Line 2: start with 'Matlab:' and say the same question in simple Hindi written in English letters, for example 'Matlab: aap yeh job kyun karna chahte ho?')"
    : "(The learner didn't understand your last question. Ask the same question again in very simple English, in one short sentence.)";
}

/** Turn the transcript into chat history, keeping only recent turns for speed. */
export function historyMessages(turns: TranscriptTurn[], maxTurns = 12): ChatMessage[] {
  return turns.slice(-maxTurns).map((t) => ({
    role: t.role === "coach" ? "assistant" : "user",
    content: t.text,
  }));
}

// ── Analysis (corrections) ────────────────────────────────────────────────

export const CORRECTION_SCHEMA = {
  type: "object",
  properties: {
    corrections: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          original: { type: "string" },
          corrected: { type: "string" },
          explanation: { type: "string" },
          alternative: { type: "string" },
          category: { type: "string", enum: ALL_MISTAKE_CATEGORIES },
        },
        required: ["original", "corrected", "explanation", "category"],
      },
    },
  },
  required: ["corrections"],
} as const;

export function analysisMessages(input: {
  learnerText: string;
  coachQuestion: string;
  mode: CorrectionMode;
  helpLanguage: Settings["helpLanguage"];
  level: Settings["level"];
}): ChatMessage[] {
  // Tuned against llama3.2:3b: an explicit checklist with an example finds real
  // mistakes, while a cautious "don't over-correct" prompt made it return
  // nothing. Over-corrections are filtered afterwards by validateAiCorrections().
  const max = input.mode === "friendly" ? 2 : 3;
  const hindi = input.helpLanguage === "hinglish" ? ", you may add a few Hindi words in Roman script" : "";
  const system = [
    "You are an English teacher checking what an Indian learner just said.",
    "Check every sentence for grammar mistakes: verb tense (e.g. 'yesterday I go' should be 'yesterday I went'), since/for, have been + -ing, articles, prepositions, extra words, subject-verb agreement, word order, and Hindi-style phrases.",
    "Ignore punctuation and capital letters (the text comes from speech recognition).",
    `For each real mistake (maximum ${max}), give: original (the learner's sentence copied exactly), corrected (the same sentence with the mistake fixed, nothing else changed), explanation (one short simple sentence${hindi}), optional alternative (a more natural way to say it), and category.`,
    `Allowed categories: ${ALL_MISTAKE_CATEGORIES.join(", ")}.`,
    "Only list real mistakes. A correct sentence must not be listed.",
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: `The coach asked: "${input.coachQuestion}"\nLearner's answer: "${input.learnerText}"` },
  ];
}

// ── End-of-session summary ───────────────────────────────────────────────

export const REPORT_SCHEMA = {
  type: "object",
  properties: {
    strengths: {
      type: "array",
      maxItems: 2,
      items: {
        type: "object",
        properties: { point: { type: "string" }, evidence: { type: "string" } },
        required: ["point", "evidence"],
      },
    },
    betterExpressions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        properties: { learnerSaid: { type: "string" }, natural: { type: "string" } },
        required: ["learnerSaid", "natural"],
      },
    },
    vocabulary: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        properties: { word: { type: "string" }, meaning: { type: "string" }, example: { type: "string" } },
        required: ["word", "meaning"],
      },
    },
  },
  required: ["strengths", "betterExpressions", "vocabulary"],
} as const;

export function reportMessages(input: { topicTitle: string; learnerAnswers: string[]; level: Settings["level"] }): ChatMessage[] {
  const answers = input.learnerAnswers
    .slice(-12)
    .map((a, i) => `${i + 1}. "${a}"`)
    .join("\n");
  return [
    {
      role: "system",
      content: [
        "You review an English speaking practice session for an Indian learner.",
        "strengths: up to 2 real strengths. \"evidence\" MUST be copied exactly from one of the learner's answers.",
        "betterExpressions: up to 3. \"learnerSaid\" MUST be copied exactly from an answer; \"natural\" says the SAME thing more naturally (do not add new information).",
        `vocabulary: up to 5 useful words or phrases the learner did NOT use but could use next time to talk about this topic more naturally, suitable for a ${input.level} learner, with a simple meaning and a short example.`,
        "Do not mention pronunciation. Do not invent anything the learner did not say. Be honest and brief.",
      ].join("\n"),
    },
    { role: "user", content: `Topic: ${input.topicTitle}\nLearner answers:\n${answers}` },
  ];
}
