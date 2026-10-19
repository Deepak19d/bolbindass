import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, loadSettings, sanitizeSettings, saveSettings } from "./settings";
import { practiceStreak } from "./streak";

describe("settings", () => {
  it("falls back to defaults for missing or corrupt storage", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, "{not json");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("sanitises invalid values", () => {
    const s = sanitizeSettings({
      level: "expert", correctionMode: "brutal", interests: ["interviews", "cooking", "interviews"],
      speechRate: 9, silenceTimeoutMs: 1234, name: "x".repeat(100), autoSpeak: "yes",
    });
    expect(s.level).toBe("intermediate");
    expect(s.correctionMode).toBe("friendly");
    expect(s.interests).toEqual(["interviews"]);
    expect(s.speechRate).toBe(1.4);
    expect(s.silenceTimeoutMs).toBe(DEFAULT_SETTINGS.silenceTimeoutMs);
    expect(s.name).toHaveLength(40);
    expect(s.autoSpeak).toBe(true);
  });

  it("persists to localStorage", () => {
    saveSettings({ ...DEFAULT_SETTINGS, correctionMode: "immersion", level: "advanced" });
    expect(loadSettings()).toMatchObject({ correctionMode: "immersion", level: "advanced" });
  });

  it("stores no API keys or secrets", () => {
    saveSettings({ ...DEFAULT_SETTINGS, ...({ sarvamApiKey: "secret" } as object) });
    expect(window.localStorage.getItem(SETTINGS_STORAGE_KEY)).not.toContain("secret");
  });
});

describe("practiceStreak", () => {
  const day = (d: number, h = 10) => new Date(2026, 9, d, h).getTime();
  it("counts consecutive days ending today or yesterday", () => {
    expect(practiceStreak([day(13), day(12), day(11), day(9)], day(13, 20))).toBe(3);
    expect(practiceStreak([day(12), day(11)], day(13, 8))).toBe(2);
    expect(practiceStreak([day(10)], day(13))).toBe(0);
  });
});
