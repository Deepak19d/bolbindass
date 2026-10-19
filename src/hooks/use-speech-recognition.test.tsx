import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpeechRecognitionEventLike } from "@/lib/speech";
import { useSpeechRecognition } from "./use-speech-recognition";

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  maxAlternatives = 1;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;
  started = false;
  constructor() {
    FakeRecognition.instances.push(this);
  }
  start() {
    this.started = true;
    this.onstart?.();
  }
  stop() {
    this.started = false;
    this.onend?.();
  }
  abort() {
    this.started = false;
    this.onend?.();
  }
  say(text: string, isFinal = true) {
    this.onresult?.({ resultIndex: 0, results: { length: 1, 0: { isFinal, length: 1, 0: { transcript: text } } } });
  }
}

const last = () => FakeRecognition.instances[FakeRecognition.instances.length - 1];

describe("useSpeechRecognition", () => {
  beforeEach(() => {
    FakeRecognition.instances = [];
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  });

  it("reports unsupported browsers (text input fallback is used instead)", () => {
    const { result } = renderHook(() => useSpeechRecognition({ lang: "en-IN", silenceTimeoutMs: 0, onUtterance: () => {} }));
    expect(result.current.supported).toBe(false);
    act(() => result.current.start());
    expect(result.current.listening).toBe(false);
  });

  it("sends the whole answer after a silence pause", () => {
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition;
    const onUtterance = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ lang: "en-IN", silenceTimeoutMs: 3000, onUtterance }));
    expect(result.current.supported).toBe(true);
    act(() => result.current.start());
    expect(last()).toMatchObject({ lang: "en-IN", continuous: true, interimResults: true });
    expect(result.current.listening).toBe(true);
    act(() => last().say("Yesterday I went"));
    act(() => vi.advanceTimersByTime(2000));
    act(() => last().say("to the market"));
    expect(result.current.heard).toBe("Yesterday I went to the market");
    act(() => vi.advanceTimersByTime(2999));
    expect(onUtterance).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(2));
    expect(onUtterance).toHaveBeenCalledWith("Yesterday I went to the market");
    expect(result.current.listening).toBe(false);
  });

  it("waits for 'Done' when auto-send is off, including interim words", () => {
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition;
    const onUtterance = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ lang: "en-IN", silenceTimeoutMs: 0, onUtterance }));
    act(() => result.current.start());
    act(() => last().say("I am a", false));
    act(() => vi.advanceTimersByTime(60_000));
    expect(onUtterance).not.toHaveBeenCalled();
    act(() => result.current.finish());
    expect(onUtterance).toHaveBeenCalledWith("I am a");
  });

  it("restarts quietly when the browser ends recognition on its own", () => {
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition;
    const { result } = renderHook(() => useSpeechRecognition({ lang: "en-IN", silenceTimeoutMs: 0, onUtterance: () => {} }));
    act(() => result.current.start());
    act(() => last().onend?.());
    expect(FakeRecognition.instances).toHaveLength(2);
    expect(last().started).toBe(true);
  });

  it("explains a blocked microphone and stops trying", () => {
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition;
    const { result } = renderHook(() => useSpeechRecognition({ lang: "en-IN", silenceTimeoutMs: 0, onUtterance: () => {} }));
    act(() => result.current.start());
    act(() => {
      last().onerror?.({ error: "not-allowed" });
      last().onend?.();
    });
    expect(result.current.error).toMatchObject({ permission: true, fatal: true });
    expect(result.current.error?.message).toMatch(/Microphone access is blocked/);
    expect(FakeRecognition.instances).toHaveLength(1);
    expect(result.current.listening).toBe(false);
  });

  it("discards speech on cancel", () => {
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition;
    const onUtterance = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ lang: "en-IN", silenceTimeoutMs: 1000, onUtterance }));
    act(() => result.current.start());
    act(() => last().say("never mind"));
    act(() => result.current.cancel());
    act(() => vi.advanceTimersByTime(5000));
    expect(onUtterance).not.toHaveBeenCalled();
    expect(result.current.heard).toBe("");
  });
});
