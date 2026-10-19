import { describe, expect, it } from "vitest";
import {
  correctionsToShow,
  formatCorrection,
  mergeCorrections,
  rankCorrections,
  ruleHitsToCorrections,
  validateAiCorrections,
  visibleCorrectionLimit,
} from "./corrections";
import { checkGrammar } from "./grammar-rules";
import { substituteFragment } from "./text";
import type { Correction } from "./types";

let n = 0;
const id = () => `c${++n}`;
const learner = "Yesterday I go to the market with my friend. I am working here since two years.";

describe("validateAiCorrections", () => {
  it("keeps a correction anchored in the learner's words", () => {
    const { accepted } = validateAiCorrections(
      [{ original: "Yesterday I go to the market with my friend.", corrected: "Yesterday I went to the market with my friend.", explanation: "Use the past tense here.", category: "past-tense" }],
      learner, "t", id,
    );
    expect(accepted).toHaveLength(1);
    expect(accepted[0]).toMatchObject({ source: "ai", category: "past-tense", turnId: "t" });
  });

  it("puts fragment-level fixes back into the full sentence (real llama3.2 output shape)", () => {
    const { accepted } = validateAiCorrections(
      [
        { original: "Yesterday I go", corrected: "Yesterday I went", explanation: "Incorrect verb tense for yesterday", category: "verb-forms" },
        { original: "since two years", corrected: "for two years", explanation: "Use for with a duration", category: "prepositions" },
      ],
      learner, "t", id,
    );
    expect(accepted.map((c) => [c.original, c.corrected])).toEqual([
      ["Yesterday I go to the market with my friend.", "Yesterday I went to the market with my friend."],
      ["I am working here since two years.", "I am working here for two years."],
    ]);
  });

  it("drops invented sentences the learner never said", () => {
    const { accepted, dropped } = validateAiCorrections(
      [{ original: "She have a big house in Mumbai.", corrected: "She has a big house in Mumbai.", explanation: "x", category: "subject-verb-agreement" }],
      learner, "t", id,
    );
    expect(accepted).toEqual([]);
    expect(dropped[0].reason).toBe("not-in-learner-text");
  });

  it("drops punctuation/capitalisation-only changes and no-op corrections", () => {
    const { accepted, dropped } = validateAiCorrections(
      [
        { original: "yesterday i go to the market with my friend", corrected: "Yesterday, I go to the market with my friend.", explanation: "Comma.", category: "other" },
        { original: "I went home.", corrected: "I went home.", explanation: "x", category: "other" },
      ],
      `${learner} I went home.`, "t", id,
    );
    expect(accepted).toEqual([]);
    expect(dropped.map((d) => d.reason)).toEqual(["no-real-change", "no-real-change"]);
  });

  it("drops rewrites that change the whole sentence", () => {
    const { dropped } = validateAiCorrections(
      [{ original: "I am working here since two years.", corrected: "My career began at this firm in 2023 and continues today.", explanation: "x", category: "other" }],
      learner, "t", id,
    );
    expect(dropped[0].reason).toBe("rewrote-too-much");
  });

  it("removes duplicates, normalises unknown categories and ignores junk", () => {
    const dup = { original: "Yesterday I go", corrected: "Yesterday I went", explanation: "Use the past tense here", category: "Tense error" };
    const { accepted } = validateAiCorrections([dup, dup, null, 42, { original: "x" }], learner, "t", id);
    expect(accepted).toHaveLength(1);
    expect(accepted[0].category).toBe("verb-forms");
    expect(validateAiCorrections("not an array", learner, "t", id).accepted).toEqual([]);
  });
});

describe("substituteFragment", () => {
  it("matches ignoring case and punctuation, keeping the rest", () => {
    expect(substituteFragment("Well, yesterday I go there.", "Yesterday I go", "yesterday I went")).toBe("Well, yesterday I went there.");
    expect(substituteFragment("I like it.", "not here", "x")).toBeNull();
  });
});

describe("mergeCorrections", () => {
  it("prefers the rule-based correction when the AI fixes the same problem", () => {
    const rules = ruleHitsToCorrections(checkGrammar(learner), "t", id);
    const { accepted } = validateAiCorrections(
      [
        { original: "Yesterday I go", corrected: "Yesterday I went", explanation: "Use the past tense here", category: "verb-forms" },
        { original: "I am working here", corrected: "I have been working here", explanation: "x", category: "verb-forms" },
        { original: "since two years", corrected: "for two years", explanation: "x", category: "prepositions" },
      ],
      learner, "t", id,
    );
    const merged = mergeCorrections(rules, accepted);
    expect(merged.every((c) => c.source === "rule")).toBe(true);
    expect(merged.map((c) => c.category).sort()).toEqual(["past-tense", "present-perfect"]);
  });

  it("keeps AI corrections for a different problem", () => {
    const text = "I go to market yesterday.";
    const rules = ruleHitsToCorrections(checkGrammar(text), "t", id);
    const { accepted } = validateAiCorrections(
      [{ original: "to market", corrected: "to the market", explanation: "Use 'the' before market here.", category: "articles" }],
      text, "t", id,
    );
    const merged = mergeCorrections(rules, accepted);
    expect(merged.map((c) => c.source)).toEqual(["rule", "ai"]);
  });
});

describe("ranking and modes", () => {
  const mk = (category: Correction["category"], source: Correction["source"] = "rule"): Correction => ({
    id: id(), turnId: "t", original: "o", corrected: "c", explanation: "e", category, source,
  });

  it("ranks recurring categories first, then by importance", () => {
    const list = [mk("comparatives"), mk("articles"), mk("past-tense", "ai")];
    expect(rankCorrections(list).map((c) => c.category)).toEqual(["past-tense", "articles", "comparatives"]);
    expect(rankCorrections(list, new Set(["comparatives"])).map((c) => c.category)[0]).toBe("comparatives");
  });

  it("shows 1-2 in friendly, up to 3 in instant, none in immersion", () => {
    const list = [mk("comparatives"), mk("articles"), mk("past-tense"), mk("plurals")];
    expect(visibleCorrectionLimit("friendly")).toBe(2);
    expect(correctionsToShow(list, "friendly")).toHaveLength(2);
    expect(correctionsToShow(list, "instant")).toHaveLength(3);
    expect(correctionsToShow(list, "immersion")).toHaveLength(0);
  });

  it("formats a correction card with original, corrected, explanation and alternative", () => {
    const [c] = ruleHitsToCorrections(checkGrammar("I discussed about the project."), "t", id);
    expect(formatCorrection(c)).toEqual({
      youSaid: "I discussed about the project.",
      better: "I discussed the project.",
      why: expect.stringContaining("Discuss"),
      alsoNatural: "I talked about the project.",
      tag: "Extra words · rule check",
    });
  });
});

describe("validateAiCorrections — junk seen from llama3.2:3b in a real session", () => {
  const text = "I have good knowledge of React and Node, and I can learn new things quickly.";

  it("drops a 'correction' that changes nothing", () => {
    const { accepted } = validateAiCorrections(
      [{ original: "I have good knowledge of React and Node", corrected: "I have good knowledge of React and Node", explanation: "No change needed, correct sentence", category: "subject-verb-agreement" }],
      text, "t", id,
    );
    expect(accepted).toEqual([]);
  });

  it("drops pure word reordering labelled as a grammar mistake", () => {
    const { accepted, dropped } = validateAiCorrections(
      [{ original: "and I can learn new things quickly", corrected: "and I can quickly learn new things", explanation: "'learn' is a stative verb, use 'learn' instead of 'learned'", category: "verb-forms" }],
      text, "t", id,
    );
    expect(accepted).toEqual([]);
    expect(dropped[0].reason).toBe("style-only");
  });

  it("drops corrections whose explanation teaches nothing", () => {
    const t = "I want to join because I discussed about your products with my friend and he told me the culture is good.";
    const { accepted, dropped } = validateAiCorrections(
      [{ original: t, corrected: "I want to join because I was told by my friend that the culture is good.", explanation: "I was told", category: "hindi-translation" }],
      t, "t", id,
    );
    expect(accepted).toEqual([]);
    expect(["useless-explanation", "rewrote-too-much"]).toContain(dropped[0].reason);
  });

  it("uses a full-sentence answer as-is even when the quote was a fragment", () => {
    const { accepted } = validateAiCorrections(
      [{ original: "since two years", corrected: "I am working here for two years.", explanation: "Use for with a length of time.", category: "present-perfect" }],
      learner, "t", id,
    );
    expect(accepted[0].corrected).toBe("I am working here for two years.");
  });
});
