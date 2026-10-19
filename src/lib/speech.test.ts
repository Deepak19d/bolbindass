import { describe, expect, it } from "vitest";
import {
  detectSpeechSupport,
  joinSpeech,
  mapRecognitionError,
  pickVoice,
  readRecognitionEvent,
  splitForSpeech,
  type SpeechRecognitionEventLike,
} from "./speech";
import { cleanForSpeech, keepFirstQuestion, stripThinking } from "./text";

describe("keepFirstQuestion — one question at a time", () => {
  it("cuts extra questions (real llama3.2:3b output)", () => {
    expect(keepFirstQuestion("Hi Deepak, how was your weekend? What did you do on Saturday?")).toBe("Hi Deepak, how was your weekend?");
  });
  it("keeps a reply with a single question, including text before it", () => {
    expect(keepFirstQuestion("That sounds great. Which part did you enjoy most?")).toBe("That sounds great. Which part did you enjoy most?");
    expect(keepFirstQuestion("Nice work.")).toBe("Nice work.");
  });
});

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";
const EDGE = `${CHROME} Edg/155.0.0.0`;
const FIREFOX = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:88.0) Gecko/20100101 Firefox/88.0";
class FakeRecognition {}

describe("detectSpeechSupport", () => {
  it("detects Chrome's prefixed recognition and synthesis", () => {
    const s = detectSpeechSupport({ webkitSpeechRecognition: FakeRecognition as never, speechSynthesis: {}, SpeechSynthesisUtterance: {}, navigator: { userAgent: CHROME } });
    expect(s).toMatchObject({ recognition: true, synthesis: true, browser: "chrome", recognitionIsCloud: true });
  });

  it("detects Edge", () => {
    expect(detectSpeechSupport({ SpeechRecognition: FakeRecognition as never, navigator: { userAgent: EDGE } }).browser).toBe("edge");
  });

  it("reports Firefox as unsupported for recognition", () => {
    const s = detectSpeechSupport({ speechSynthesis: {}, SpeechSynthesisUtterance: {}, navigator: { userAgent: FIREFOX } });
    expect(s).toMatchObject({ recognition: false, synthesis: true, browser: "firefox" });
  });

  it("handles no window at all (server)", () => {
    expect(detectSpeechSupport(undefined)).toMatchObject({ recognition: false, synthesis: false });
  });
});

describe("mapRecognitionError", () => {
  it("explains microphone permission errors and stops listening", () => {
    const e = mapRecognitionError("not-allowed");
    expect(e).toMatchObject({ fatal: true, permission: true });
    expect(e.message).toMatch(/Microphone access is blocked/);
    expect(e.message).toMatch(/typing/);
    expect(mapRecognitionError("service-not-allowed").permission).toBe(true);
  });

  it("handles missing mic, offline and transient errors", () => {
    expect(mapRecognitionError("audio-capture")).toMatchObject({ fatal: true, permission: false });
    expect(mapRecognitionError("network").message).toMatch(/internet/);
    expect(mapRecognitionError("no-speech").fatal).toBe(false);
    expect(mapRecognitionError("aborted").fatal).toBe(false);
    expect(mapRecognitionError("weird").fatal).toBe(false);
  });
});

describe("recognition results", () => {
  it("separates final and interim text from resultIndex", () => {
    const e: SpeechRecognitionEventLike = {
      resultIndex: 1,
      results: {
        length: 3,
        0: { isFinal: true, length: 1, 0: { transcript: "old" } },
        1: { isFinal: true, length: 1, 0: { transcript: " I went home" } },
        2: { isFinal: false, length: 1, 0: { transcript: " and then" } },
      },
    };
    expect(readRecognitionEvent(e)).toEqual({ finalText: "I went home", interim: "and then" });
    expect(joinSpeech("I went home", "and then")).toBe("I went home and then");
    expect(joinSpeech("", " ")).toBe("");
  });
});

describe("speech synthesis helpers", () => {
  const v = (voiceURI: string, lang: string, localService: boolean, isDefault = false) => ({ voiceURI, name: voiceURI, lang, localService, default: isDefault });
  const voices = [v("Google US", "en-US", false, true), v("Microsoft Heera", "en-IN", true), v("Microsoft Zira", "en-US", true), v("Hindi", "hi-IN", true)];

  it("prefers the chosen voice, then an offline voice in the chosen variant", () => {
    expect(pickVoice(voices, "Microsoft Zira", "en-IN")?.voiceURI).toBe("Microsoft Zira");
    expect(pickVoice(voices, "", "en-IN")?.voiceURI).toBe("Microsoft Heera");
    expect(pickVoice(voices, "", "en-US")?.voiceURI).toBe("Microsoft Zira");
    expect(pickVoice([], "", "en-IN")).toBeNull();
  });

  it("splits long replies into short chunks and strips markdown/emoji", () => {
    const long = `${"This is a fairly long sentence that keeps going, ".repeat(6)}end. **Bold** question? 😊`;
    const chunks = splitForSpeech(long, 120);
    expect(chunks.every((c) => c.length <= 120)).toBe(true);
    expect(chunks.join(" ")).not.toMatch(/\*|😊/);
    expect(cleanForSpeech("<think>hmm</think>Hello **there**!")).toBe("Hello there!");
    expect(stripThinking("<think>unfinished")).toBe("");
  });
});
