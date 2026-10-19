import { describe, expect, it } from "vitest";
import { canSubmit, initialPracticeState, practiceReducer, type PracticeAction, type PracticeState } from "./practice-machine";
import type { SessionRecord, TranscriptTurn } from "./types";

const session: SessionRecord = {
  id: "s", startedAt: 0, endedAt: null, durationSec: 0, topicId: "daily-routine", topicTitle: "Routine",
  topicCategory: "daily-life", topicReason: "", focusCategories: [], mode: "friendly", engine: "ollama",
  model: "llama3.2:3b", level: "intermediate", turns: [], report: null,
};
const coach = (id: string): TranscriptTurn => ({ id, role: "coach", text: "How was your day?", at: 1, source: "ai" });
const learner = (id: string, text = "It was good."): TranscriptTurn => ({ id, role: "learner", text, at: 2, source: "voice", analysis: "pending" });

function run(actions: PracticeAction[], start: PracticeState = initialPracticeState): PracticeState {
  return actions.reduce(practiceReducer, start);
}

describe("practiceReducer", () => {
  it("runs a full friendly-mode turn cycle", () => {
    let s = run([{ type: "START", session }]);
    expect(s.phase).toBe("starting");
    s = run([{ type: "COACH_STREAM", text: "How" }], s);
    expect(s.streamingText).toBe("How");
    s = run([{ type: "COACH_DONE", turn: coach("c1"), speak: true }], s);
    expect(s).toMatchObject({ phase: "coach-speaking", streamingText: "" });
    s = run([{ type: "SPEECH_DONE" }], s);
    expect(s.phase).toBe("your-turn");
    s = run([{ type: "LEARNER_SUBMIT", turn: learner("l1"), checkFirst: false }], s);
    expect(s.phase).toBe("coach-thinking");
    s = run([{ type: "COACH_DONE", turn: coach("c2"), speak: false }], s);
    expect(s.phase).toBe("your-turn");
    s = run([{ type: "ANALYSIS_DONE", turnId: "l1", corrections: [], analysis: "done" }], s);
    expect(s.session!.turns.map((t) => t.role)).toEqual(["coach", "learner", "coach"]);
    expect(s.session!.turns[1].analysis).toBe("done");
    expect(s.phase).toBe("your-turn");
  });

  it("instant mode checks the answer before the coach replies", () => {
    let s = run([{ type: "START", session }, { type: "COACH_DONE", turn: coach("c1"), speak: false }]);
    s = run([{ type: "LEARNER_SUBMIT", turn: learner("l1"), checkFirst: true }], s);
    expect(s.phase).toBe("checking");
    s = run([{ type: "ANALYSIS_DONE", turnId: "l1", corrections: [], analysis: "done" }], s);
    expect(s.phase).toBe("coach-thinking");
  });

  it("lets the learner interrupt the coach's voice but not its thinking", () => {
    expect(canSubmit("coach-speaking")).toBe(true);
    expect(canSubmit("coach-thinking")).toBe(false);
    const thinking = run([{ type: "START", session }]);
    expect(run([{ type: "LEARNER_SUBMIT", turn: learner("l1"), checkFirst: false }], thinking)).toBe(thinking);
  });

  it("ignores empty answers", () => {
    const s = run([{ type: "START", session }, { type: "COACH_DONE", turn: coach("c1"), speak: false }]);
    expect(run([{ type: "LEARNER_SUBMIT", turn: learner("l1", "   "), checkFirst: false }], s)).toBe(s);
  });

  it("returns to setup with an error if the opening fails", () => {
    const s = run([{ type: "START", session }, { type: "COACH_FAILED", error: "Ollama is not running" }]);
    expect(s).toMatchObject({ phase: "setup", session: null, error: "Ollama is not running" });
  });

  it("gives the turn back to the learner if a reply fails mid-session", () => {
    let s = run([{ type: "START", session }, { type: "COACH_DONE", turn: coach("c1"), speak: false }]);
    s = run([{ type: "LEARNER_SUBMIT", turn: learner("l1"), checkFirst: false }, { type: "COACH_FAILED", error: "boom" }], s);
    expect(s).toMatchObject({ phase: "your-turn", error: "boom" });
    s = run([{ type: "COACH_REQUEST" }], s);
    expect(s).toMatchObject({ phase: "coach-thinking", error: null });
  });

  it("only switches to Basic mode when explicitly asked", () => {
    const s = run([{ type: "START", session }, { type: "COACH_DONE", turn: coach("c1"), speak: false }]);
    expect(s.session!.engine).toBe("ollama");
    expect(run([{ type: "SWITCH_TO_BASIC" }], s).session).toMatchObject({ engine: "basic", model: null });
  });

  it("ends from any active phase and ignores late analysis", () => {
    let s = run([{ type: "START", session }, { type: "COACH_DONE", turn: coach("c1"), speak: false }, { type: "LEARNER_SUBMIT", turn: learner("l1"), checkFirst: false }]);
    s = run([{ type: "END_REQUEST" }], s);
    expect(s.phase).toBe("ending");
    const late = run([{ type: "ANALYSIS_DONE", turnId: "l1", corrections: [], analysis: "done" }], s);
    expect(late).toBe(s);
    s = run([{ type: "ENDED", session: { ...s.session!, endedAt: 5 } }], s);
    expect(s.phase).toBe("ended");
    expect(run([{ type: "RESET" }], s)).toEqual(initialPracticeState);
  });

  it("cannot end a session that hasn't started", () => {
    expect(run([{ type: "END_REQUEST" }])).toBe(initialPracticeState);
  });
});
