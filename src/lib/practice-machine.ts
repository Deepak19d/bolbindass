// Pure state machine for one practice conversation. Side effects (AI calls,
// speech, storage) live in the usePracticeSession hook; this reducer only
// decides what state the conversation is in.

import type { Correction, AnalysisState, Engine, SessionRecord, TranscriptTurn } from "./types";

export type Phase =
  | "setup" // choosing a topic
  | "starting" // coach is preparing the opening question
  | "coach-thinking" // waiting for / streaming the coach reply
  | "checking" // instant mode: checking the answer before the reply
  | "coach-speaking" // reply is being read aloud
  | "your-turn" // waiting for the learner (voice or text)
  | "ending" // building the report
  | "ended";

export interface PracticeState {
  phase: Phase;
  session: SessionRecord | null;
  streamingText: string;
  error: string | null;
}

export type PracticeAction =
  | { type: "START"; session: SessionRecord }
  | { type: "COACH_STREAM"; text: string }
  | { type: "COACH_DONE"; turn: TranscriptTurn; speak: boolean }
  | { type: "COACH_FAILED"; error: string }
  | { type: "SPEECH_DONE" }
  | { type: "LEARNER_SUBMIT"; turn: TranscriptTurn; checkFirst: boolean }
  | { type: "ANALYSIS_DONE"; turnId: string; corrections: Correction[]; analysis: AnalysisState }
  | { type: "COACH_REQUEST" }
  | { type: "SWITCH_TO_BASIC" }
  | { type: "END_REQUEST" }
  | { type: "ENDED"; session: SessionRecord }
  | { type: "SET_ERROR"; error: string | null }
  | { type: "RESET" };

export const initialPracticeState: PracticeState = {
  phase: "setup",
  session: null,
  streamingText: "",
  error: null,
};

const ACTIVE: Phase[] = ["starting", "coach-thinking", "checking", "coach-speaking", "your-turn"];

export function isActivePhase(phase: Phase): boolean {
  return ACTIVE.includes(phase);
}

/** Can the learner submit an answer right now? (They may interrupt the coach's voice.) */
export function canSubmit(phase: Phase): boolean {
  return phase === "your-turn" || phase === "coach-speaking";
}

function withTurns(state: PracticeState, turns: TranscriptTurn[]): SessionRecord | null {
  return state.session ? { ...state.session, turns } : null;
}

export function practiceReducer(state: PracticeState, action: PracticeAction): PracticeState {
  switch (action.type) {
    case "START":
      if (state.phase !== "setup") return state;
      return { phase: "starting", session: action.session, streamingText: "", error: null };

    case "COACH_STREAM":
      if (state.phase !== "starting" && state.phase !== "coach-thinking") return state;
      return { ...state, streamingText: action.text };

    case "COACH_DONE": {
      if ((state.phase !== "starting" && state.phase !== "coach-thinking") || !state.session) return state;
      return {
        ...state,
        session: withTurns(state, [...state.session.turns, action.turn]),
        streamingText: "",
        phase: action.speak ? "coach-speaking" : "your-turn",
        error: null,
      };
    }

    case "COACH_FAILED":
      if (!state.session) return state;
      if (state.phase === "starting" && state.session.turns.length === 0) {
        // Opening failed: go back to topic setup with the error.
        return { ...initialPracticeState, error: action.error };
      }
      if (!["starting", "coach-thinking", "checking"].includes(state.phase)) return state;
      return { ...state, phase: "your-turn", streamingText: "", error: action.error };

    case "SPEECH_DONE":
      return state.phase === "coach-speaking" ? { ...state, phase: "your-turn" } : state;

    case "LEARNER_SUBMIT": {
      if (!canSubmit(state.phase) || !state.session) return state;
      if (!action.turn.text.trim()) return state;
      return {
        ...state,
        session: withTurns(state, [...state.session.turns, action.turn]),
        phase: action.checkFirst ? "checking" : "coach-thinking",
        error: null,
      };
    }

    case "ANALYSIS_DONE": {
      // Late results must not change a session that is being finalised.
      if (!state.session || state.phase === "ending" || state.phase === "ended") return state;
      const turns = state.session.turns.map((t) =>
        t.id === action.turnId ? { ...t, corrections: action.corrections, analysis: action.analysis } : t,
      );
      const phase = state.phase === "checking" ? "coach-thinking" : state.phase;
      return { ...state, session: withTurns(state, turns), phase };
    }

    case "COACH_REQUEST":
      // Retry, "say it simpler", or a reply after switching to Basic mode.
      return canSubmit(state.phase) ? { ...state, phase: "coach-thinking", error: null } : state;

    case "SWITCH_TO_BASIC":
      if (!state.session) return state;
      return {
        ...state,
        session: { ...state.session, engine: "basic" as Engine, model: null },
        error: null,
      };

    case "END_REQUEST":
      if (!isActivePhase(state.phase) || !state.session) return state;
      return { ...state, phase: "ending", streamingText: "" };

    case "ENDED":
      if (state.phase !== "ending") return state;
      return { ...state, phase: "ended", session: action.session };

    case "SET_ERROR":
      return { ...state, error: action.error };

    case "RESET":
      return initialPracticeState;
  }
}
