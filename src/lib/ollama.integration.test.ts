// @vitest-environment node
//
// REAL local-model test. Skipped by default; run it with a local Ollama running:
//   $env:OLLAMA_INTEGRATION="1"; npx vitest run src/lib/ollama.integration.test.ts
// It only talks to 127.0.0.1 — never to an external service.

import { describe, expect, it } from "vitest";
import { parseJsonLoose } from "./ai-client";
import { mergeCorrections, ruleHitsToCorrections, validateAiCorrections } from "./corrections";
import { checkGrammar } from "./grammar-rules";
import {
  analysisMessages,
  coachSystemPrompt,
  CORRECTION_SCHEMA,
  openingInstruction,
  REPORT_SCHEMA,
  reportMessages,
  type ChatMessage,
} from "./prompts";
import { buildReport } from "./report";
import { getOllamaStatus, ollamaChatPayload, pickModel } from "./server/ollama";
import { getTopic } from "./topics";
import { containsNormalized } from "./text";
import type { SessionRecord } from "./types";

const RUN = process.env.OLLAMA_INTEGRATION === "1";
const URL_BASE = "http://127.0.0.1:11434";

async function chat(model: string, messages: ChatMessage[], format?: object, numPredict = 300): Promise<string> {
  const res = await fetch(`${URL_BASE}/api/chat`, {
    method: "POST",
    body: JSON.stringify(
      ollamaChatPayload(
        { model, messages, options: { temperature: 0.1, num_predict: numPredict }, format: format as Record<string, unknown> },
        false,
      ),
    ),
  });
  const j = (await res.json()) as { message?: { content?: string }; error?: string };
  if (j.error) throw new Error(j.error);
  return j.message?.content ?? "";
}

let counter = 0;
const id = () => `id-${++counter}`;

describe.skipIf(!RUN)("local Ollama (real model)", () => {
  let model = "";

  it("finds a local, non-cloud model", async () => {
    const status = await getOllamaStatus();
    expect(status.state).toBe("online");
    expect(status.models.every((m) => !m.name.includes("cloud"))).toBe(true);
    model = pickModel(status.models) ?? "";
    expect(model).not.toBe("");
    console.log("model:", model, "| hidden cloud models:", status.cloudModelsHidden);
  }, 20_000);

  it("opens the conversation with one question", async () => {
    const topic = getTopic("daily-last-weekend")!;
    const text = await chat(
      model,
      [
        {
          role: "system",
          content: coachSystemPrompt({
            settings: { name: "Deepak", goal: "job interviews", level: "intermediate", helpLanguage: "hinglish", correctionMode: "friendly" },
            topic,
            focusCategories: ["past-tense"],
            avoidQuestions: [],
          }),
        },
        { role: "user", content: openingInstruction("Deepak") },
      ],
      undefined,
      120,
    );
    console.log("opening:", text);
    expect(text).toContain("?");
  }, 180_000);

  it("returns corrections that are anchored in the learner's words", async () => {
    const learner = "Yesterday I go to the market with my friend. I am working here since two years.";
    const raw = await chat(
      model,
      analysisMessages({ learnerText: learner, coachQuestion: "What did you do yesterday?", mode: "friendly", helpLanguage: "english", level: "intermediate" }),
      CORRECTION_SCHEMA,
    );
    const parsed = parseJsonLoose<{ corrections?: unknown }>(raw);
    const { accepted, dropped } = validateAiCorrections(parsed.corrections, learner, "t1", id);
    console.log("AI accepted:", JSON.stringify(accepted, null, 1), "\ndropped:", dropped.map((d) => d.reason));
    for (const c of accepted) expect(containsNormalized(learner, c.original)).toBe(true);
    // What the learner actually sees: rule-based + AI, merged.
    const merged = mergeCorrections(ruleHitsToCorrections(checkGrammar(learner), "t1", id), accepted);
    console.log("merged:", merged.map((c) => `${c.source}/${c.category}: ${c.corrected}`));
    expect(merged.map((c) => c.category)).toEqual(expect.arrayContaining(["past-tense", "present-perfect"]));
  }, 180_000);

  it("does not keep invented corrections for a correct sentence", async () => {
    const learner = "I went to the market yesterday and bought some vegetables.";
    const raw = await chat(
      model,
      analysisMessages({ learnerText: learner, coachQuestion: "What did you do yesterday?", mode: "friendly", helpLanguage: "english", level: "intermediate" }),
      CORRECTION_SCHEMA,
    );
    const { accepted, dropped } = validateAiCorrections(parseJsonLoose<{ corrections?: unknown }>(raw).corrections, learner, "t2", id);
    console.log("correct sentence → accepted:", accepted.length, "dropped:", dropped.map((d) => d.reason));
    for (const c of accepted) expect(containsNormalized(learner, c.original)).toBe(true);
  }, 180_000);

  it("produces a validated report summary", async () => {
    const answers = [
      "Last weekend I went to Pune with my family and we visited a fort.",
      "I am working as a developer since two years and I like it.",
      "We discussed about a new feature in the meeting yesterday.",
    ];
    const raw = await chat(model, reportMessages({ topicTitle: "What you did last weekend", learnerAnswers: answers, level: "intermediate" }), REPORT_SCHEMA, 500);
    const extras = parseJsonLoose<Record<string, unknown>>(raw);
    const session: SessionRecord = {
      id: "s1", startedAt: 0, endedAt: 60_000, durationSec: 60, topicId: "daily-last-weekend",
      topicTitle: "What you did last weekend", topicCategory: "daily-life", topicReason: "", focusCategories: [],
      mode: "friendly", engine: "ollama", model, level: "intermediate", report: null,
      turns: answers.map((text, i) => ({ id: `l${i}`, role: "learner" as const, text, at: i * 1000, source: "typed" as const, corrections: [] })),
    };
    const report = buildReport({ session, memory: [], nextTopic: null, aiExtras: extras, now: 1 });
    console.log("strengths:", report.strengths, "\nvocab:", report.vocabulary, "\nexpressions:", report.betterExpressions);
    const all = answers.join(" ");
    for (const s of report.strengths) if (s.evidence) expect(containsNormalized(all, s.evidence) || answers.some((a) => containsNormalized(a, s.evidence!))).toBe(true);
    for (const e of report.betterExpressions) expect(answers.some((a) => containsNormalized(a, e.learnerSaid))).toBe(true);
  }, 240_000);
});
