"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { completeJson, LocalAiError, streamChat } from "@/lib/ai-client";
import { mergeCorrections, ruleHitsToCorrections, validateAiCorrections } from "@/lib/corrections";
import { listMistakes, listSessions, replaceMistakes, saveSession } from "@/lib/db";
import { finalizeSession } from "@/lib/finalize";
import { checkGrammar } from "@/lib/grammar-rules";
import {
  canSubmit,
  initialPracticeState,
  isActivePhase,
  practiceReducer,
} from "@/lib/practice-machine";
import {
  analysisMessages,
  coachSystemPrompt,
  CORRECTION_SCHEMA,
  historyMessages,
  openingInstruction,
  REPORT_SCHEMA,
  reportMessages,
  simplerInstruction,
  type ChatMessage,
} from "@/lib/prompts";
import type { AiReportExtras } from "@/lib/report";
import { joinSpeech } from "@/lib/speech";
import { keepFirstQuestion, wordCount } from "@/lib/text";
import { nextBasicQuestion, previousQuestionsForTopic, type TopicChoice } from "@/lib/topic-selector";
import { getTopic } from "@/lib/topics";
import type { SessionRecord, Settings, TranscriptTurn, TurnSource } from "@/lib/types";
import { useSpeechRecognition } from "./use-speech-recognition";
import { useSpeechSynthesis } from "./use-speech-synthesis";

const uuid = () => crypto.randomUUID();

function lastCoachText(turns: TranscriptTurn[]): string {
  return [...turns].reverse().find((t) => t.role === "coach")?.text ?? "";
}

function errorMessage(err: unknown): string {
  if (err instanceof LocalAiError) return err.message;
  return err instanceof Error ? err.message : "Something went wrong with the local AI.";
}

export function usePracticeSession(settings: Settings) {
  const [state, dispatch] = useReducer(practiceReducer, initialPracticeState);
  const stateRef = useRef(state);
  const settingsRef = useRef(settings);
  useEffect(() => {
    stateRef.current = state;
    settingsRef.current = settings;
  });

  const [micOn, setMicOn] = useState(true);
  const [draft, setDraft] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const historyRef = useRef<SessionRecord[]>([]);
  // Next.js keeps visited pages mounted but hidden; don't talk while hidden.
  const visibleRef = useRef(false);
  const replyCtrl = useRef<AbortController | null>(null);
  const analysisCtrls = useRef(new Set<AbortController>());
  const reportCtrl = useRef<AbortController | null>(null);

  const tts = useSpeechSynthesis({
    voiceURI: settings.voiceURI,
    rate: settings.speechRate,
    lang: settings.speechLang,
  });

  // Declared before use by the recognition callback below; assigned later.
  const submitRef = useRef<(text: string, source: TurnSource) => void>(() => {});

  const recognition = useSpeechRecognition({
    lang: settings.speechLang,
    silenceTimeoutMs: settings.silenceTimeoutMs,
    onUtterance: (text) => {
      if (settingsRef.current.reviewBeforeSend) setDraft((d) => joinSpeech(d, text));
      else submitRef.current(text, "voice");
    },
  });
  const { start: startListening, cancel: cancelListening } = recognition;

  // ── Coach turns ────────────────────────────────────────────────────────

  const deliverCoachTurn = useCallback(
    async (turn: TranscriptTurn) => {
      const speak = settingsRef.current.autoSpeak && tts.supported && visibleRef.current;
      dispatch({ type: "COACH_DONE", turn, speak });
      if (speak) {
        cancelListening(); // never record the coach's own voice
        await tts.speak(turn.text);
        dispatch({ type: "SPEECH_DONE" });
      }
    },
    [cancelListening, tts],
  );

  const basicReply = useCallback(
    (session: SessionRecord) => {
      const topic = getTopic(session.topicId);
      const next = topic
        ? nextBasicQuestion(topic, session.turns, previousQuestionsForTopic(historyRef.current, topic.id))
        : null;
      const text = next
        ? next.text
        : "That was my last question on this topic. Press End session to see your report, or start a new topic.";
      void deliverCoachTurn({ id: uuid(), role: "coach", text, at: Date.now(), source: "basic" });
    },
    [deliverCoachTurn],
  );

  const aiReply = useCallback(
    async (session: SessionRecord, extraInstruction?: string, helper = false) => {
      const topic = getTopic(session.topicId);
      if (!topic || !session.model) {
        dispatch({ type: "COACH_FAILED", error: "No local model is selected." });
        return;
      }
      const s = settingsRef.current;
      const system = coachSystemPrompt({
        settings: s,
        topic,
        focusCategories: session.focusCategories,
        avoidQuestions: previousQuestionsForTopic(historyRef.current, topic.id),
      });
      const messages: ChatMessage[] = [
        { role: "system", content: system },
        { role: "user", content: openingInstruction(s.name) },
        ...historyMessages(session.turns.filter((t) => !t.helper)),
      ];
      if (extraInstruction) messages.push({ role: "user", content: extraInstruction });

      replyCtrl.current?.abort();
      const ctrl = new AbortController();
      replyCtrl.current = ctrl;
      try {
        const text = await streamChat(
          { model: session.model, messages, options: { temperature: 0.7, num_predict: 180 } },
          { signal: ctrl.signal, onText: (t) => dispatch({ type: "COACH_STREAM", text: t }) },
        );
        // One question at a time (the "Matlab:" help reply intentionally repeats it in Hindi).
        const reply = helper ? text : keepFirstQuestion(text);
        await deliverCoachTurn({ id: uuid(), role: "coach", text: reply, at: Date.now(), source: "ai", helper });
      } catch (err) {
        if (err instanceof LocalAiError && err.kind === "aborted") return;
        dispatch({ type: "COACH_FAILED", error: errorMessage(err) });
      } finally {
        if (replyCtrl.current === ctrl) replyCtrl.current = null;
      }
    },
    [deliverCoachTurn],
  );

  // ── Corrections ────────────────────────────────────────────────────────

  const analyse = useCallback(async (session: SessionRecord, turn: TranscriptTurn) => {
    if (!session.model) return;
    const s = settingsRef.current;
    const ctrl = new AbortController();
    analysisCtrls.current.add(ctrl);
    try {
      const raw = await completeJson<{ corrections?: unknown }>(
        {
          model: session.model,
          messages: analysisMessages({
            learnerText: turn.text,
            coachQuestion: lastCoachText(session.turns.filter((t) => t.id !== turn.id)),
            mode: session.mode,
            helpLanguage: s.helpLanguage,
            level: s.level,
          }),
          schema: CORRECTION_SCHEMA,
          options: { temperature: 0.1, num_predict: 350 },
        },
        { signal: ctrl.signal },
      );
      const { accepted } = validateAiCorrections(raw?.corrections, turn.text, turn.id, uuid);
      dispatch({
        type: "ANALYSIS_DONE",
        turnId: turn.id,
        corrections: mergeCorrections(turn.corrections ?? [], accepted),
        analysis: "done",
      });
    } catch (err) {
      if (err instanceof LocalAiError && err.kind === "aborted") return;
      dispatch({ type: "ANALYSIS_DONE", turnId: turn.id, corrections: turn.corrections ?? [], analysis: "failed" });
    } finally {
      analysisCtrls.current.delete(ctrl);
    }
  }, []);

  // ── Learner actions ────────────────────────────────────────────────────

  const submit = useCallback(
    async (text: string, source: TurnSource) => {
      const current = stateRef.current;
      const clean = text.trim();
      if (!current.session || !canSubmit(current.phase) || !clean) return;
      tts.cancel();
      if (source === "typed") cancelListening();

      const id = uuid();
      const useAi = current.session.engine === "ollama" && wordCount(clean) >= 3;
      const turn: TranscriptTurn = {
        id,
        role: "learner",
        text: clean,
        at: Date.now(),
        source,
        corrections: ruleHitsToCorrections(checkGrammar(clean), id, uuid),
        analysis: useAi ? "pending" : "done",
      };
      const checkFirst = useAi && current.session.mode === "instant";
      dispatch({ type: "LEARNER_SUBMIT", turn, checkFirst });
      setDraft("");
      const session = { ...current.session, turns: [...current.session.turns, turn] };

      if (session.engine === "basic") {
        basicReply(session);
        return;
      }
      if (checkFirst) {
        await analyse(session, turn);
        await aiReply(session);
      } else {
        await aiReply(session);
        if (useAi) void analyse(session, turn);
      }
    },
    [aiReply, analyse, basicReply, cancelListening, tts],
  );
  useEffect(() => {
    submitRef.current = (text, source) => void submit(text, source);
  }, [submit]);

  const start = useCallback(
    async (choice: TopicChoice, engine: "ollama" | "basic", model: string | null) => {
      if (stateRef.current.phase !== "setup") return;
      const s = settingsRef.current;
      const session: SessionRecord = {
        id: uuid(),
        startedAt: Date.now(),
        endedAt: null,
        durationSec: 0,
        topicId: choice.topic.id,
        topicTitle: choice.topic.title,
        topicCategory: choice.topic.category,
        topicReason: choice.reason,
        focusCategories: choice.focusCategories,
        mode: s.correctionMode,
        engine,
        model: engine === "ollama" ? model : null,
        level: s.level,
        turns: [],
        report: null,
      };
      dispatch({ type: "START", session });
      setMicOn(true);
      historyRef.current = await listSessions().catch(() => []);
      if (engine === "basic") {
        const q = nextBasicQuestion(choice.topic, [], previousQuestionsForTopic(historyRef.current, choice.topic.id));
        const hello = s.name ? `Hi ${s.name}!` : "Hi!";
        await deliverCoachTurn({
          id: uuid(),
          role: "coach",
          text: `${hello} Let's talk about ${choice.topic.title.toLowerCase()}. ${q?.text ?? ""}`.trim(),
          at: Date.now(),
          source: "basic",
        });
      } else {
        await aiReply(session);
      }
    },
    [aiReply, deliverCoachTurn],
  );

  const retry = useCallback(() => {
    const current = stateRef.current;
    if (!current.session || current.phase !== "your-turn") return;
    dispatch({ type: "COACH_REQUEST" });
    if (current.session.engine === "basic") basicReply(current.session);
    else void aiReply(current.session);
  }, [aiReply, basicReply]);

  const askSimpler = useCallback(() => {
    const current = stateRef.current;
    if (!current.session || current.session.engine !== "ollama" || !canSubmit(current.phase)) return;
    tts.cancel();
    cancelListening();
    dispatch({ type: "COACH_REQUEST" });
    void aiReply(current.session, simplerInstruction(settingsRef.current.helpLanguage), true);
  }, [aiReply, cancelListening, tts]);

  /** Only ever called by an explicit learner click — never automatically. */
  const switchToBasic = useCallback(() => {
    const current = stateRef.current;
    if (!current.session) return;
    replyCtrl.current?.abort();
    dispatch({ type: "SWITCH_TO_BASIC" });
    const session = { ...current.session, engine: "basic" as const, model: null };
    const last = session.turns[session.turns.length - 1];
    if (current.phase === "your-turn" && last?.role === "learner") {
      dispatch({ type: "COACH_REQUEST" });
      basicReply(session);
    }
  }, [basicReply]);

  const replayLast = useCallback(async () => {
    const current = stateRef.current;
    if (!current.session || current.phase !== "your-turn") return;
    const text = lastCoachText(current.session.turns);
    if (!text) return;
    cancelListening();
    await tts.speak(text);
    const s = settingsRef.current;
    if (s.handsFree && micOn && stateRef.current.phase === "your-turn") startListening();
  }, [cancelListening, micOn, startListening, tts]);

  const end = useCallback(async () => {
    const current = stateRef.current;
    if (!current.session || !isActivePhase(current.phase)) return;
    replyCtrl.current?.abort();
    analysisCtrls.current.forEach((c) => c.abort());
    cancelListening();
    tts.cancel();

    if (!current.session.turns.some((t) => t.role === "learner")) {
      // Nothing to report yet — discard instead of saving an empty session.
      dispatch({ type: "RESET" });
      return "discarded" as const;
    }
    dispatch({ type: "END_REQUEST" });
    const session = current.session;
    const ctrl = new AbortController();
    reportCtrl.current = ctrl;
    setSummarizing(session.engine === "ollama");
    try {
      const final = await finalizeSession(session, true, {
        settings: settingsRef.current,
        now: Date.now(),
        store: { listSessions, listMistakes, replaceMistakes, saveSession },
        getAiExtras:
          session.engine === "ollama" && session.model
            ? (s) =>
                completeJson<AiReportExtras>(
                  {
                    model: session.model!,
                    messages: reportMessages({
                      topicTitle: s.topicTitle,
                      learnerAnswers: s.turns.filter((t) => t.role === "learner").map((t) => t.text),
                      level: s.level,
                    }),
                    schema: REPORT_SCHEMA,
                    options: { temperature: 0.2, num_predict: 500 },
                  },
                  { signal: ctrl.signal },
                )
            : undefined,
      });
      dispatch({ type: "ENDED", session: final });
      return "ended" as const;
    } catch (err) {
      dispatch({ type: "SET_ERROR", error: `Could not save the session: ${errorMessage(err)}` });
      return "failed" as const;
    } finally {
      setSummarizing(false);
      reportCtrl.current = null;
    }
  }, [cancelListening, tts]);

  const skipSummary = useCallback(() => reportCtrl.current?.abort(), []);

  const reset = useCallback(() => {
    replyCtrl.current?.abort();
    cancelListening();
    tts.cancel();
    dispatch({ type: "RESET" });
  }, [cancelListening, tts]);

  // ── Effects ────────────────────────────────────────────────────────────

  // Hands-free: listen whenever it's the learner's turn.
  const canListen = state.phase === "your-turn" && micOn && settings.handsFree && recognition.supported && !recognition.error;
  useEffect(() => {
    if (canListen) startListening();
  }, [canListen, startListening]);

  // Stop the mic when it's not the learner's turn or when muted.
  useEffect(() => {
    if (state.phase !== "your-turn" || !micOn) cancelListening();
  }, [state.phase, micOn, cancelListening]);

  // Autosave the transcript locally after each change (once the learner has spoken).
  useEffect(() => {
    const s = state.session;
    if (!s || !isActivePhase(state.phase)) return;
    if (!s.turns.some((t) => t.role === "learner")) return;
    saveSession(s).catch(() => {
      dispatch({ type: "SET_ERROR", error: "Could not save to local storage. Your browser may be in private mode." });
    });
  }, [state.session, state.phase]);

  // In-flight local AI calls are allowed to finish while the page is hidden
  // (its state is preserved), but the coach won't speak until it's visible.
  useEffect(() => {
    visibleRef.current = true;
    return () => {
      visibleRef.current = false;
    };
  }, []);

  const listenNow = useCallback(() => {
    const phase = stateRef.current.phase;
    if (phase === "coach-speaking") {
      tts.cancel();
      dispatch({ type: "SPEECH_DONE" });
    }
    if (phase === "your-turn" || phase === "coach-speaking") {
      setMicOn(true);
      recognition.clearError();
      startListening();
    }
  }, [recognition, startListening, tts]);

  return {
    state,
    dispatch,
    start,
    submit,
    end,
    skipSummary,
    summarizing,
    askSimpler,
    retry,
    switchToBasic,
    replayLast,
    reset,
    listenNow,
    micOn,
    setMicOn,
    draft,
    setDraft,
    recognition,
    tts,
  };
}

export type PracticeSessionApi = ReturnType<typeof usePracticeSession>;
